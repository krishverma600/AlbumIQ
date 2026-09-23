from django.db.models import Count
from django.shortcuts import get_object_or_404
import logging
from rest_framework import permissions, response, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.views import APIView

from apps.events.models import Event

from .models import Photo
from .serializers import PhotoSerializer, PhotoUploadSerializer
from .tasks import process_photo_embeddings


logger = logging.getLogger(__name__)


class PhotoUploadAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        serializer = PhotoUploadSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        event = get_object_or_404(
            Event,
            event_code=serializer.validated_data["event_code"],
            created_by=request.user,
        )

        created_photos = []
        for image in serializer.validated_data["images"]:
            photo = Photo.objects.create(
                event=event,
                image=image,
                uploaded_by=request.user,
                original_filename=image.name,
            )
            created_photos.append(photo)
            try:
                process_photo_embeddings.delay(str(photo.id))
            except Exception:
                logger.exception("Unable to queue photo processing for photo %s", photo.id)

        return response.Response(
            {
                "event_id": str(event.id),
                "queued": len(created_photos),
                "photos": PhotoSerializer(created_photos, many=True, context={"request": request}).data,
            },
            status=status.HTTP_201_CREATED,
        )


class PhotoStatusAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, event_id, *args, **kwargs):
        event = get_object_or_404(Event, id=event_id, created_by=request.user)
        photos = event.photos.all()
        status_rows = photos.values("processing_status").annotate(count=Count("id"))
        status_breakdown = {row["processing_status"]: row["count"] for row in status_rows}

        return response.Response(
            {
                "event_id": str(event.id),
                "event_code": event.event_code,
                "total": photos.count(),
                "status_breakdown": status_breakdown,
                "photos": PhotoSerializer(photos, many=True, context={"request": request}).data,
            }
        )

