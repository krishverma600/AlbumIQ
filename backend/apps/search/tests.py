from io import BytesIO
from tempfile import TemporaryDirectory
from unittest.mock import patch

from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.users.models import User
from apps.events.models import Event
from apps.photos.models import Photo
from apps.photos.tasks import process_photo_embeddings
from apps.face_engine.models import FaceEmbedding
from apps.face_engine.services import DetectedFace, FaceEngineUnavailable


class PhotoSearchFlowTests(TestCase):
    def setUp(self):
        self.media = TemporaryDirectory()
        self.addCleanup(self.media.cleanup)
        self.settings_override = override_settings(MEDIA_ROOT=self.media.name, FACE_MATCH_THRESHOLD=0.45,
            STORAGES={'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'}})
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.admin = User.objects.create_user(username='photographer', email='studio@example.com', password='Testing!12345')
        self.event = Event.objects.create(created_by=self.admin, event_name='Wedding', event_code='WED-TEST')
        self.other = Event.objects.create(created_by=self.admin, event_name='Other', event_code='WED-ELSE')
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.guest = APIClient()
        self.face = DetectedFace([1.0, 0.0, 0.0], {'top': 0, 'right': 100, 'bottom': 100, 'left': 0})
        self.model_patches = [patch('apps.photos.tasks.embedding_model_key', return_value='test:v1'),
            patch('apps.photos.views.embedding_model_key', return_value='test:v1'),
            patch('apps.search.services.embedding_model_key', return_value='test:v1')]
        for p in self.model_patches:
            p.start(); self.addCleanup(p.stop)

    def image(self, name='photo.jpg'):
        buffer = BytesIO()
        Image.new('RGB', (100, 100), 'white').save(buffer, format='JPEG')
        return SimpleUploadedFile(name, buffer.getvalue(), content_type='image/jpeg')

    def photo(self, event=None, vector=None, model='test:v1', status='COMPLETED'):
        photo = Photo.objects.create(event=event or self.event, image=self.image(), processing_status=status)
        FaceEmbedding.objects.create(photo=photo, face_index=0, embedding_model=model,
            embedding_vector=vector or self.face.embedding_vector, face_location=self.face.face_location)
        return photo

    def search(self, faces=None):
        with patch('apps.search.services.extract_embeddings', return_value=[self.face] if faces is None else faces):
            return self.guest.post('/api/search/', {'event_code': self.event.event_code, 'selfie': self.image()}, format='multipart')

    def test_only_target_person_and_current_event_and_model_returned(self):
        target = self.photo()
        self.photo(vector=[0.0, 1.0, 0.0])
        self.photo(event=self.other)
        self.photo(model='legacy')
        self.photo(status='PROCESSING')
        self.photo(vector=[1.0, 0.0])
        response = self.search()
        self.assertEqual(response.status_code, 200)
        self.assertEqual([p['photo_id'] for p in response.data['matched_images']], [target.pk])

    def test_group_photo_returned_once_when_target_is_present(self):
        photo = self.photo()
        FaceEmbedding.objects.create(photo=photo, face_index=1, embedding_model='test:v1',
            embedding_vector=[0.99, 0.01, 0.0], face_location={})
        self.assertEqual(self.search().data['matched_count'], 1)

    def test_no_face_selfie_rejected(self):
        self.assertEqual(self.search([]).status_code, 400)

    def test_multiple_face_selfie_rejected(self):
        self.assertEqual(self.search([self.face, self.face]).status_code, 400)

    def test_other_person_has_no_matches(self):
        self.photo(vector=[0.0, 1.0, 0.0])
        self.assertEqual(self.search().data['matched_count'], 0)

    def test_upload_process_status_search(self):
        with patch('apps.photos.views.process_photo_embeddings.delay'):
            response = self.client.post('/api/photos/upload/', {'event_code': self.event.event_code, 'images': [self.image()]}, format='multipart')
        self.assertEqual(response.status_code, 201)
        photo_id = response.data['photos'][0]['id']
        with patch('apps.photos.tasks.extract_embeddings', return_value=[self.face]):
            process_photo_embeddings.run(str(photo_id))
        response = self.client.get(f'/api/photos/status/{self.event.pk}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status_breakdown'], {'COMPLETED': 1})
        self.assertEqual(self.search().data['matched_count'], 1)

    def test_broker_failure_not_reported_as_queued(self):
        with patch('apps.photos.views.process_photo_embeddings.delay', side_effect=ConnectionError('broker unavailable')):
            response = self.client.post('/api/photos/upload/', {'event_code': self.event.event_code, 'images': [self.image()]}, format='multipart')
        self.assertEqual(response.data['queued'], 0)
        self.assertEqual(response.data['failed'], 1)
        self.assertEqual(response.data['photos'][0]['processing_status'], 'FAILED')

    def test_upload_requires_event_ownership(self):
        other_user = User.objects.create_user(username='other', email='other@example.com')
        self.client.force_authenticate(other_user)
        response = self.client.post('/api/photos/upload/', {'event_code': self.event.event_code, 'images': [self.image()]}, format='multipart')
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.client.get(f'/api/photos/status/{self.event.pk}/').status_code, 404)

    def test_invalid_album_file_rejected(self):
        response = self.client.post('/api/photos/upload/', {'event_code': self.event.event_code,
            'images': [SimpleUploadedFile('bad.jpg', b'not an image')]}, format='multipart')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Photo.objects.count(), 0)

    def test_event_fields_persist(self):
        with patch('apps.events.serializers.send_event_code_sms') as sms:
            sms.return_value.sent = False; sms.return_value.status = 'skipped'; sms.return_value.detail = ''
            response = self.client.post('/api/events/', {'event_name': 'New', 'venue': 'Palace', 'welcome_message': 'Welcome'}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['venue'], 'Palace')
        self.assertEqual(response.data['welcome_message'], 'Welcome')

    def test_reprocessing_replaces_legacy_embeddings(self):
        photo = self.photo(model='legacy')
        with patch('apps.photos.tasks.extract_embeddings', return_value=[self.face]):
            process_photo_embeddings.run(str(photo.pk))
        self.assertEqual(photo.embeddings.count(), 1)
        self.assertEqual(photo.embeddings.get().embedding_model, 'test:v1')
        self.assertEqual(self.search().data['matched_count'], 1)

    @override_settings(FACE_ENGINE_PROVIDER='opencv')
    def test_pixel_fallback_cannot_be_used_for_identity_search(self):
        from apps.face_engine.services import embedding_model_key
        with self.assertRaises(FaceEngineUnavailable):
            embedding_model_key()

    def test_deepface_requires_real_face_detection(self):
        from apps.face_engine.services import extract_embeddings_with_deepface
        with patch('apps.face_engine.services.DeepFace') as engine:
            engine.represent.return_value = []
            self.assertEqual(extract_embeddings_with_deepface('image.jpg'), [])
            self.assertTrue(engine.represent.call_args.kwargs['enforce_detection'])

    def test_sideways_album_face_is_detected_and_box_mapped_back(self):
        from apps.face_engine.services import extract_embeddings, local_image_path
        photo = self.photo()
        detected = DetectedFace([1.0, 0.0, 0.0], {'left': 10, 'top': 20, 'right': 30, 'bottom': 40})
        with patch('apps.face_engine.services.embedding_model_key', return_value='deepface:test'), \
             patch('apps.face_engine.services.extract_embeddings_with_deepface', side_effect=[[], [detected]]) as extractor:
            with local_image_path(photo.image) as path:
                faces = extract_embeddings(path)
        self.assertEqual(extractor.call_count, 2)
        self.assertEqual(faces[0].face_location, {'left': 60, 'top': 10, 'right': 80, 'bottom': 30})

    def test_exif_orientation_is_applied_before_detection(self):
        from apps.face_engine.services import local_image_path
        buffer = BytesIO()
        exif = Image.Exif(); exif[274] = 6
        Image.new('RGB', (40, 80), 'white').save(buffer, format='JPEG', exif=exif)
        photo = Photo.objects.create(event=self.event, image=SimpleUploadedFile('rotated.jpg', buffer.getvalue(), content_type='image/jpeg'))
        with local_image_path(photo.image) as path:
            with Image.open(path) as normalized:
                self.assertEqual(normalized.size, (80, 40))

    def test_names_never_determine_matching(self):
        target = self.photo()
        target.original_filename = 'completely-different-name.jpg'
        target.save(update_fields=['original_filename'])
        other = self.photo(vector=[0.0, 1.0, 0.0])
        other.original_filename = 'photo.jpg'
        other.save(update_fields=['original_filename'])
        self.assertEqual([item['photo_id'] for item in self.search().data['matched_images']], [target.pk])

    @override_settings(FACE_MATCH_THRESHOLD=None)
    def test_deepface_threshold_uses_normalized_euclidean_metric(self):
        import sys
        from types import SimpleNamespace
        from unittest.mock import Mock
        from apps.face_engine.services import matching_threshold
        find_threshold = Mock(return_value=1.13)
        with patch('apps.face_engine.services.embedding_model_key', return_value='deepface:ArcFace:yunet'), \
             patch.dict(sys.modules, {'deepface.modules.verification': SimpleNamespace(find_threshold=find_threshold)}):
            self.assertEqual(matching_threshold(), 1.13)
            find_threshold.assert_called_once_with('ArcFace', 'euclidean_l2')

    def test_distinct_views_of_person_return_all_photos_but_not_other_person(self):
        import math
        expected = []
        for distance in [0.0, 0.6838, 0.9573, 1.0577]:
            x = 1 - distance * distance / 2
            photo = self.photo(vector=[x, math.sqrt(1-x*x), 0.0])
            expected.append(photo.pk)
        self.photo(vector=[0.0, 0.0, 1.0])
        self.photo(event=self.other)
        with patch('apps.search.services.matching_threshold', return_value=1.13):
            self.assertEqual([p['photo_id'] for p in self.search().data['matched_images']], expected)

    def test_album_photo_without_face_is_not_marked_completed(self):
        photo = Photo.objects.create(event=self.event, image=self.image())
        with patch('apps.photos.tasks.extract_embeddings', return_value=[]):
            result = process_photo_embeddings.run(str(photo.pk))
        photo.refresh_from_db()
        self.assertEqual(photo.processing_status, 'NO_FACES')
        self.assertIn('not searchable', photo.processing_error)
        self.assertEqual(result['faces_found'], 0)

    def test_no_match_response_explains_album_readiness(self):
        self.photo(vector=[0.0, 1.0, 0.0])
        Photo.objects.create(event=self.event, image=self.image(), processing_status='NO_FACES')
        Photo.objects.create(event=self.event, image=self.image(), processing_status='QUEUED')
        Photo.objects.create(event=self.event, image=self.image(), processing_status='FAILED')
        response = self.search()
        self.assertEqual(response.data['matched_count'], 0)
        self.assertEqual(response.data['album_status'], {'total': 4, 'searchable': 1, 'no_faces': 1, 'pending': 1, 'failed': 1})

    def test_guest_reference_is_not_silently_added_to_event_album(self):
        self.assertEqual(self.search().status_code, 200)
        self.assertEqual(self.event.photos.count(), 0)
