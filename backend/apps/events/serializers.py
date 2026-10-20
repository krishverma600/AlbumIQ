from rest_framework import serializers

from .models import Event
from .notifications import send_event_code_sms
from .services import build_guest_portal_url, generate_event_code, generate_qr_code_asset


class EventSerializer(serializers.ModelSerializer):
    qr_url = serializers.CharField(source="qr_code_url", read_only=True)
    photo_count = serializers.SerializerMethodField()
    sms_notification = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = (
            "id",
            "event_name",
            "event_date",
            "venue",
            "welcome_message",
            "event_code",
            "guest_portal_url",
            "qr_url",
            "created_at",
            "photo_count",
            "sms_notification",
        )
        read_only_fields = ("id", "event_code", "guest_portal_url", "qr_url", "created_at", "photo_count", "sms_notification")

    def get_photo_count(self, obj) -> int:
        return obj.photos.count()

    def get_sms_notification(self, obj):
        return getattr(obj, "_sms_notification", None)

    def create(self, validated_data):
        request = self.context["request"]
        event_code = generate_event_code()
        event = Event.objects.create(
            event_code=event_code,
            guest_portal_url=build_guest_portal_url(event_code),
            created_by=request.user,
            **validated_data,
        )
        qr_url = generate_qr_code_asset(event_code)
        event.qr_code_url = (
            request.build_absolute_uri(qr_url) if qr_url.startswith("/") else qr_url
        )
        event.save(update_fields=["qr_code_url"])
        sms_result = send_event_code_sms(
            to_phone_number=request.user.phone_number,
            photographer_name=request.user.full_name or request.user.username or request.user.email,
            event_name=event.event_name,
            event_code=event.event_code,
            event_date=event.event_date,
            guest_portal_url=event.guest_portal_url,
        )
        event._sms_notification = {
            "status": sms_result.status,
            "sent": sms_result.sent,
            "detail": sms_result.detail,
            "to": request.user.phone_number,
        }
        return event
