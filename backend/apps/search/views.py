from django.shortcuts import get_object_or_404
from rest_framework import permissions, response, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.views import APIView

from apps.events.models import Event
from apps.face_engine.services import FaceEngineUnavailable

from .models import GuestSearch
from .serializers import GuestSearchRequestSerializer
from .services import album_search_status, run_guest_search


class GuestSearchAPIView(APIView):
    permission_classes = [permissions.AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        serializer = GuestSearchRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        event = get_object_or_404(Event, event_code=serializer.validated_data["event_code"])
        guest_search = GuestSearch.objects.create(
            event=event,
            selfie=serializer.validated_data["selfie"],
        )

        try:
            matches = run_guest_search(guest_search)
        except FaceEngineUnavailable as exc:
            return response.Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        payload = []
        for match in matches:
            photo = match["photo"]
            image_url = request.build_absolute_uri(photo.image.url) if photo.image else ""
            payload.append(
                {
                    "photo_id": photo.id,
                    "filename": photo.original_filename,
                    "image_url": image_url,
                    "similarity": match["similarity"],
                }
            )

        return response.Response(
            {
                "search_id": str(guest_search.id),
                "matched_count": len(payload),
                "matched_images": payload,
                "album_status": album_search_status(event),
            }
        )

