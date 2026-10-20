"""Import publicly downloadable Drive photos without Google account credentials."""
from email.message import Message
from pathlib import PurePosixPath
import re
import socket
import time
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers


MAX_PHOTO_BYTES = 20 * 1024 * 1024
MAX_LINKS = 20
ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{10,200}$")


class DriveImportError(ValueError):
    pass


def parse_drive_link(link):
    parsed = urlparse(link.strip())
    if (parsed.scheme != "https" or parsed.hostname != "drive.google.com"
            or parsed.username or parsed.password or parsed.port not in (None, 443)):
        raise DriveImportError("Use a Google Drive photo sharing link starting with https://drive.google.com/.")
    query = parse_qs(parsed.query)
    match = re.fullmatch(r"/file/d/([A-Za-z0-9_-]+)(?:/view|/preview|/edit)?/?", parsed.path)
    file_id = match.group(1) if match else (query.get("id", [""])[0] if parsed.path in ("/open", "/uc") else "")
    if not ID_PATTERN.fullmatch(file_id):
        raise DriveImportError("Paste an individual photo's sharing link. Folder links are not supported.")
    resource_key = query.get("resourcekey", [""])[0]
    if resource_key and not ID_PATTERN.fullmatch(resource_key):
        raise DriveImportError("The Google Drive resource key is invalid.")
    return {"file_id": file_id, "resource_key": resource_key}


def validate_download_url(url):
    parsed = urlparse(url)
    host = parsed.hostname or ""
    allowed = host in ("drive.google.com", "drive.usercontent.google.com") or host.endswith(".googleusercontent.com")
    if not allowed or parsed.scheme != "https" or parsed.username or parsed.password or parsed.port not in (None, 443):
        raise DriveImportError("Google Drive redirected to an unsupported download address.")


class DriveRedirectHandler(HTTPRedirectHandler):
    max_redirections = 5
    max_repeats = 2

    def redirect_request(self, request, fp, code, message, headers, newurl):
        validate_download_url(newurl)
        return super().redirect_request(request, fp, code, message, headers, newurl)


def download_drive_photo(file_id, resource_key=""):
    if not ID_PATTERN.fullmatch(file_id) or (resource_key and not ID_PATTERN.fullmatch(resource_key)):
        raise DriveImportError("Invalid Google Drive file identifier.")
    params = {"id": file_id, "export": "download", "confirm": "t"}
    if resource_key:
        params["resourcekey"] = resource_key
    url = "https://drive.usercontent.google.com/download?" + urlencode(params)
    request = Request(url, headers={"User-Agent": "AlbumIQ/1.0"})
    try:
        with build_opener(DriveRedirectHandler()).open(request, timeout=20) as remote:
            validate_download_url(remote.geturl())
            if "text/html" in remote.headers.get("Content-Type", "").lower():
                raise DriveImportError('Photo is not directly downloadable. Set sharing to "Anyone with the link" and allow downloads.')
            length = remote.headers.get("Content-Length")
            if length and int(length) > MAX_PHOTO_BYTES:
                raise DriveImportError("Each Drive photo must be 20 MB or smaller.")
            content = bytearray()
            deadline = time.monotonic() + 60
            while True:
                chunk = remote.read(min(65536, MAX_PHOTO_BYTES + 1 - len(content)))
                if not chunk:
                    break
                content.extend(chunk)
                if len(content) > MAX_PHOTO_BYTES:
                    raise DriveImportError("Each Drive photo must be 20 MB or smaller.")
                if time.monotonic() > deadline:
                    raise DriveImportError("Google Drive download timed out. Please try again.")
            disposition = Message()
            disposition["Content-Disposition"] = remote.headers.get("Content-Disposition", "")
            filename = disposition.get_filename() or f"drive-{file_id}.jpg"
            filename = PurePosixPath(filename.replace("\\", "/")).name[:240]
            image = SimpleUploadedFile(filename, bytes(content), content_type=remote.headers.get("Content-Type", "application/octet-stream"))
    except HTTPError as exc:
        raise DriveImportError('Google Drive could not provide the photo. Check sharing permissions and download limits.') from exc
    except (URLError, socket.timeout, TimeoutError) as exc:
        raise DriveImportError("Could not download from Google Drive. Please try again.") from exc
    try:
        return serializers.ImageField().run_validation(image)
    except (serializers.ValidationError, DjangoValidationError) as exc:
        raise DriveImportError("The Drive file is not a supported photo. Use JPG, PNG, or WEBP.") from exc
