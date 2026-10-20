from io import BytesIO
from tempfile import TemporaryDirectory
from unittest.mock import patch

from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APIClient

from apps.events.models import Event
from apps.users.models import User
from .models import Photo
from .drive import DriveImportError, DriveRedirectHandler, download_drive_photo, parse_drive_link
from .tasks import import_drive_photo

LINK = 'https://drive.google.com/file/d/1AbcdefGhIjKlMn/view?usp=sharing'


def image_bytes():
    data = BytesIO()
    Image.new('RGB', (80, 80), 'white').save(data, format='JPEG')
    return data.getvalue()


class RemotePhoto(BytesIO):
    def __init__(self, data, headers=None):
        super().__init__(data)
        self.headers = headers or {'Content-Type': 'image/jpeg', 'Content-Disposition': 'attachment; filename="wedding.jpg"'}

    def geturl(self):
        return 'https://drive.usercontent.google.com/download?id=1AbcdefGhIjKlMn'


class DriveDownloadTests(SimpleTestCase):
    def test_supported_links_and_resource_key(self):
        self.assertEqual(parse_drive_link(LINK)['file_id'], '1AbcdefGhIjKlMn')
        file = parse_drive_link('https://drive.google.com/open?id=1AbcdefGhIjKlMn&resourcekey=0-abcdef123456')
        self.assertEqual(file['resource_key'], '0-abcdef123456')

    def test_only_individual_google_drive_links_accepted(self):
        for link in ['http://drive.google.com/file/d/1AbcdefGhIjKlMn/view',
                     'https://evil.example/file/d/1AbcdefGhIjKlMn/view',
                     'https://drive.google.com/drive/folders/1AbcdefGhIjKlMn',
                     'https://drive.google.com@127.0.0.1/open?id=1AbcdefGhIjKlMn']:
            with self.subTest(link=link), self.assertRaises(DriveImportError):
                parse_drive_link(link)

    def test_redirect_cannot_reach_arbitrary_server(self):
        with self.assertRaises(DriveImportError):
            DriveRedirectHandler().redirect_request(None, None, 302, '', {}, 'http://127.0.0.1/private')

    def test_download_validates_photo_and_preserves_filename(self):
        with patch('apps.photos.drive.build_opener') as opener:
            opener.return_value.open.return_value = RemotePhoto(image_bytes())
            image = download_drive_photo('1AbcdefGhIjKlMn', '0-abcdef123456')
            self.assertEqual(image.name, 'wedding.jpg')
            self.assertIn('resourcekey=0-abcdef123456', opener.return_value.open.call_args.args[0].full_url)

    def test_private_page_or_non_image_is_rejected(self):
        for data, headers in [(b'<html>Sign in</html>', {'Content-Type': 'text/html'}),
                              (b'not a photo', {'Content-Type': 'application/octet-stream'})]:
            with patch('apps.photos.drive.build_opener') as opener:
                opener.return_value.open.return_value = RemotePhoto(data, headers)
                with self.assertRaises(DriveImportError):
                    download_drive_photo('1AbcdefGhIjKlMn')

    def test_size_limit_with_and_without_content_length(self):
        for headers in [{'Content-Type': 'image/jpeg', 'Content-Length': '100'}, {'Content-Type': 'image/jpeg'}]:
            with patch('apps.photos.drive.build_opener') as opener, patch('apps.photos.drive.MAX_PHOTO_BYTES', 8):
                opener.return_value.open.return_value = RemotePhoto(b'x' * 100, headers)
                with self.assertRaises(DriveImportError):
                    download_drive_photo('1AbcdefGhIjKlMn')


class DriveImportFlowTests(TestCase):
    def setUp(self):
        temporary = TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        settings = override_settings(MEDIA_ROOT=temporary.name, STORAGES={'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'}})
        settings.enable(); self.addCleanup(settings.disable)
        self.user = User.objects.create_user(username='studio', email='studio@example.com')
        self.event = Event.objects.create(created_by=self.user, event_name='Wedding', event_code='WED-TEST')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        engine = patch('apps.photos.views.embedding_model_key', return_value='test:v1')
        engine.start(); self.addCleanup(engine.stop)

    def submit(self, links=None):
        return self.client.post('/api/photos/import-drive/', {'event_code': self.event.event_code, 'links': links or [LINK]}, format='json')

    def test_import_is_queued_and_duplicate_links_are_deduplicated(self):
        with patch('apps.photos.views.import_drive_photo.delay') as queue:
            response = self.submit([LINK, LINK])
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data['queued'], 1)
        self.assertEqual(response.data['photos'][0]['processing_status'], 'IMPORTING')
        self.assertEqual(response.data['photos'][0]['image_url'], '')
        self.assertEqual(queue.call_count, 1)

    def test_import_downloads_then_queues_existing_face_pipeline(self):
        photo = Photo.objects.create(event=self.event, uploaded_by=self.user, processing_status='IMPORTING')
        with patch('apps.photos.tasks.download_drive_photo', return_value=SimpleUploadedFile('wedding.jpg', image_bytes(), content_type='image/jpeg')), \
             patch('apps.photos.tasks.process_photo_embeddings.delay') as queue:
            import_drive_photo.run(str(photo.pk), '1AbcdefGhIjKlMn')
        photo.refresh_from_db()
        self.assertEqual(photo.processing_status, 'QUEUED')
        self.assertEqual(photo.original_filename, 'wedding.jpg')
        self.assertTrue(photo.image.storage.exists(photo.image.name))
        queue.assert_called_once_with(str(photo.pk))

    def test_failed_download_exposes_actionable_status(self):
        photo = Photo.objects.create(event=self.event, uploaded_by=self.user, processing_status='IMPORTING')
        with patch('apps.photos.tasks.download_drive_photo', side_effect=DriveImportError('Check sharing permissions.')):
            import_drive_photo.run(str(photo.pk), '1AbcdefGhIjKlMn')
        response = self.client.get(f'/api/photos/status/{self.event.pk}/')
        self.assertEqual(response.data['photos'][0]['processing_status'], 'FAILED')
        self.assertIn('sharing permissions', response.data['photos'][0]['processing_error'])

    def test_requires_authentication_and_event_ownership(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.submit().status_code, 401)
        other = User.objects.create_user(username='other', email='other@example.com')
        self.client.force_authenticate(other)
        self.assertEqual(self.submit().status_code, 404)
        self.assertEqual(Photo.objects.count(), 0)

    def test_invalid_link_rejected_before_creating_photos(self):
        self.assertEqual(self.submit([LINK, 'https://example.com/photo.jpg']).status_code, 400)
        self.assertEqual(Photo.objects.count(), 0)

    def test_queue_failure_is_not_reported_as_started(self):
        with patch('apps.photos.views.import_drive_photo.delay', side_effect=ConnectionError), patch('apps.photos.views.logger'):
            response = self.submit()
        self.assertEqual(response.data['queued'], 0)
        self.assertEqual(response.data['failed'], 1)
        self.assertEqual(response.data['photos'][0]['processing_status'], 'FAILED')
