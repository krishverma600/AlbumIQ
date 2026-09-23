import random
import string
from django.db import models
from django.conf import settings


def generate_event_code():
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


class Event(models.Model):
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="events"
    )

    event_name = models.CharField(max_length=255)
    event_date = models.DateField(null=True, blank=True)
    venue = models.CharField(max_length=255, blank=True, null=True)
    welcome_message = models.TextField(blank=True, null=True)

    event_code = models.CharField(
        max_length=8, unique=True, default=generate_event_code
    )
    guest_portal_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    qr_code_url = models.CharField(max_length=500, blank=True)

    def __str__(self):
        return f"{self.event_name} ({self.event_code})"


class Guest(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="guests")
    whatsapp_number = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    selfie = models.ImageField(upload_to="guest_selfies/")
    joined_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Guest {self.id} for {self.event.event_code}"
