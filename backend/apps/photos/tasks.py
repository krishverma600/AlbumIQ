from celery import shared_task
import logging

from apps.face_engine.models import FaceEmbedding
from apps.face_engine.services import FaceEngineUnavailable, extract_embeddings, embedding_model_key, local_image_path

from .models import Photo
from .drive import DriveImportError, download_drive_photo


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def process_photo_embeddings(self, photo_id: str):
    try:
        photo = Photo.objects.get(id=photo_id)
        photo.processing_status = "PROCESSING"
        photo.processing_error = ""
        photo.save(update_fields=["processing_status", "processing_error"])

        model_key = embedding_model_key()
        with local_image_path(photo.image) as image_path:
            detections = extract_embeddings(image_path)
        FaceEmbedding.objects.filter(photo=photo).delete()
        FaceEmbedding.objects.bulk_create(
            [
                FaceEmbedding(
                    photo=photo,
                    face_index=index,
                    embedding_model=model_key,
                    embedding_vector=detection.embedding_vector,
                    face_location=detection.face_location,
                )
                for index, detection in enumerate(detections)
            ]
        )

        photo.processing_status = "COMPLETED" if detections else "NO_FACES"
        photo.processing_error = "" if detections else "No face was detected. This photo is not searchable. Try a clearer or higher-resolution image."
        photo.save(update_fields=["processing_status", "processing_error"])
        return {"photo_id": photo_id, "faces_found": len(detections), "status": "completed" if detections else "no_faces"}

    except Photo.DoesNotExist:
        return {"photo_id": photo_id, "faces_found": 0, "status": "failed - not found"}
    except FaceEngineUnavailable:
        Photo.objects.filter(id=photo_id).update(processing_status="FAILED", processing_error="Face recognition is unavailable. Contact the photographer.")
        raise
    except Exception:
        Photo.objects.filter(id=photo_id).update(processing_status="FAILED", processing_error="Face processing failed. Please retry processing this photo.")
        raise


@shared_task
def import_drive_photo(photo_id, file_id, resource_key=""):
    try:
        photo = Photo.objects.get(pk=photo_id)
    except Photo.DoesNotExist:
        return
    if photo.processing_status != "IMPORTING":
        return
    try:
        image = download_drive_photo(file_id, resource_key)
        photo.image.save(image.name, image, save=False)
        photo.original_filename = image.name
        photo.processing_status = "QUEUED"
        photo.processing_error = ""
        photo.save(update_fields=["image", "original_filename", "processing_status", "processing_error"])
        process_photo_embeddings.delay(str(photo.pk))
    except DriveImportError as exc:
        Photo.objects.filter(pk=photo.pk).update(processing_status="FAILED", processing_error=str(exc))
    except Exception:
        logging.getLogger(__name__).exception("Drive import failed for photo %s", photo.pk)
        Photo.objects.filter(pk=photo.pk).update(processing_status="FAILED", processing_error="Import or processing could not be queued. Please try again.")
