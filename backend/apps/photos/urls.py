from django.urls import path

from .views import DrivePhotoImportAPIView, PhotoStatusAPIView, PhotoUploadAPIView


urlpatterns = [
    path("upload/", PhotoUploadAPIView.as_view(), name="photo-upload"),
    path("import-drive/", DrivePhotoImportAPIView.as_view(), name="photo-import-drive"),
    path("status/<int:event_id>/", PhotoStatusAPIView.as_view(), name="photo-status"),
]

