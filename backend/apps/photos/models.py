from django.db import models
from apps.events.models import Event


class Photo(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="photos")
    uploaded_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_photos",
    )
    image = models.ImageField(upload_to="event_photos/")
    original_filename = models.CharField(max_length=255, blank=True)
    processing_status = models.CharField(max_length=32, default="QUEUED")
    faiss_id = models.BigIntegerField(null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Photo {self.id} for {self.event.event_name}"

