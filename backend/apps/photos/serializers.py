from rest_framework import serializers
from .models import Photo
from .drive import DriveImportError, MAX_LINKS, parse_drive_link


class DrivePhotoImportSerializer(serializers.Serializer):
    event_code = serializers.CharField(max_length=16)
    links = serializers.ListField(child=serializers.CharField(max_length=2048), min_length=1, max_length=MAX_LINKS)

    def validate_links(self, links):
        files = []
        seen = set()
        for index, link in enumerate(links):
            try:
                file = parse_drive_link(link)
            except ValueError as exc:
                raise serializers.ValidationError(f"Link {index + 1}: {exc}") from exc
            if file["file_id"] not in seen:
                seen.add(file["file_id"])
                files.append(file)
        return files


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

        image_field = serializers.ImageField()
        attrs["images"] = [image_field.run_validation(image) for image in images]
        return attrs


class PhotoSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    face_count = serializers.IntegerField(source="embeddings.count", read_only=True)

    class Meta:
        model = Photo
        fields = (
            "id",
            "event",
            "image_url",
            "original_filename",
            "processing_status",
            "processing_error",
            "face_count",
            "uploaded_at",
        )
        read_only_fields = fields

    def get_image_url(self, obj) -> str:
        request = self.context.get("request")
        if not obj.image:
            return ""

        url = obj.image.url
        return request.build_absolute_uri(url) if request else url

