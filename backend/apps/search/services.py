from rest_framework.exceptions import ValidationError

from apps.face_engine.models import FaceEmbedding
from apps.face_engine.services import extract_embeddings, find_matches, embedding_model_key, local_image_path, matching_threshold


def album_search_status(event):
    photos = event.photos.all()
    searchable = photos.filter(processing_status="COMPLETED", embeddings__embedding_model=embedding_model_key()).distinct().count()
    return {
        "total": photos.count(),
        "searchable": searchable,
        "no_faces": photos.filter(processing_status="NO_FACES").count() + photos.filter(processing_status="COMPLETED", embeddings__isnull=True).count(),
        "pending": photos.filter(processing_status__in=["IMPORTING", "QUEUED", "PROCESSING"]).count(),
        "failed": photos.filter(processing_status="FAILED").count(),
    }


def run_guest_search(search):
    model_key = embedding_model_key()
    with local_image_path(search.selfie) as image_path:
        query_faces = extract_embeddings(image_path)
    if len(query_faces) != 1:
        raise ValidationError({"detail": "Upload a clear selfie containing exactly one face."})
    candidate_embeddings = list(
        FaceEmbedding.objects.select_related("photo").filter(photo__event=search.event, photo__processing_status="COMPLETED", embedding_model=model_key)
    )
    best_matches_by_photo = {}
    threshold = matching_threshold()

    for query_face in query_faces:
        matches = find_matches(
            query_face.embedding_vector,
            candidate_embeddings,
            threshold=threshold,
        )
        for match in matches:
            photo = match["embedding"].photo
            existing = best_matches_by_photo.get(photo.id)
            if existing is None or match["distance"] < existing["distance"]:
                best_matches_by_photo[photo.id] = {
                    "photo": photo,
                    "distance": match["distance"],
                    "similarity": match["similarity"],
                }

    ordered_matches = sorted(best_matches_by_photo.values(), key=lambda item: item["distance"])
    search.matched_count = len(ordered_matches)
    search.save(update_fields=["matched_count"])
    return ordered_matches
