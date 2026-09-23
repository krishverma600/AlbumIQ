from celery import shared_task

from apps.face_engine.models import FaceEmbedding
from apps.face_engine.services import FaceEngineUnavailable, extract_embeddings

from .models import Photo


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
        photo.save(update_fields=["processing_status"])

        detections = extract_embeddings(photo.image.path)
        FaceEmbedding.objects.filter(photo=photo).delete()
        FaceEmbedding.objects.bulk_create(
            [
                FaceEmbedding(
                    photo=photo,
                    face_index=index,
                    embedding_vector=detection.embedding_vector,
                    face_location=detection.face_location,
                )
                for index, detection in enumerate(detections)
            ]
        )

        photo.processing_status = "COMPLETED"
        photo.save(update_fields=["processing_status"])
        return {"photo_id": photo_id, "faces_found": len(detections), "status": "completed"}

    except Photo.DoesNotExist:
        return {"photo_id": photo_id, "faces_found": 0, "status": "failed - not found"}
    except FaceEngineUnavailable:
        Photo.objects.filter(id=photo_id).update(processing_status="FAILED")
        raise
    except Exception:
        Photo.objects.filter(id=photo_id).update(processing_status="FAILED")
        raise
