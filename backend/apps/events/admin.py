from django.contrib import admin
from .models import Event, Guest


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ("event_name", "event_code", "created_by", "event_date")
    list_filter = ("created_at",)


@admin.register(Guest)
class GuestAdmin(admin.ModelAdmin):
    list_display = ("id", "event", "email", "whatsapp_number", "joined_at")
