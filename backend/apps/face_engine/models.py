import uuid

from django.db import models


class FaceEmbedding(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    photo = models.ForeignKey("photos.Photo", on_delete=models.CASCADE, related_name="embeddings")
    face_index = models.PositiveIntegerField(default=0)
    embedding_model = models.CharField(max_length=100, default="legacy")
    embedding_vector = models.JSONField()
    face_location = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("photo", "face_index")

    def __str__(self) -> str:
        return f"{self.photo} face #{self.face_index}"

