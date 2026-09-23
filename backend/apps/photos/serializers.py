from rest_framework import serializers
from .models import Photo


class PhotoUploadSerializer(serializers.Serializer):
    event_code = serializers.CharField(max_length=16)

    def validate(self, attrs):
        request = self.context.get("request")
        if request is None:
            raise serializers.ValidationError("Request context is required.")

        images = request.FILES.getlist("images") or request.FILES.getlist("images[]")
        if not images:
            raise serializers.ValidationError(
                {"images": "At least one image is required."}
            )

        attrs["images"] = images
        return attrs


class PhotoSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Photo
        fields = (
            "id",
            "event",
            "image_url",
            "original_filename",
            "processing_status",
            "uploaded_at",
        )
        read_only_fields = fields

    def get_image_url(self, obj) -> str:
        request = self.context.get("request")
        if not obj.image:
            return ""

        url = obj.image.url
        return request.build_absolute_uri(url) if request else url

