from contextlib import contextmanager
from tempfile import NamedTemporaryFile
from pathlib import Path
from dataclasses import dataclass
import math

from django.conf import settings
from PIL import Image, ImageOps

try:
    import face_recognition
except ImportError:  # pragma: no cover - handled at runtime
    face_recognition = None

try:
    from deepface import DeepFace
except ImportError:  # pragma: no cover - handled at runtime
    DeepFace = None

try:
    import numpy as np
except ImportError:  # pragma: no cover - handled at runtime
    np = None


class FaceEngineUnavailable(RuntimeError):
    pass


@dataclass
class DetectedFace:
    embedding_vector: list[float]
    face_location: dict[str, int]


def ensure_numpy() -> None:
    if np is None:
        raise FaceEngineUnavailable("numpy is required for face embedding generation.")


def ensure_face_recognition() -> None:
    if face_recognition is None:
        raise FaceEngineUnavailable(
            "face_recognition is not installed. Install backend/requirements-ai.txt."
        )


def ensure_deepface() -> None:
    if DeepFace is None:
        raise FaceEngineUnavailable(
            "deepface is not installed. Install backend/requirements-ai.txt."
        )


def _normalise_embedding(vector) -> list[float]:
    ensure_numpy()
    array = np.asarray(vector, dtype="float32")
    norm = float(np.linalg.norm(array))
    if norm > 0:
        array = array / norm
    return [float(value) for value in array.tolist()]


def extract_embeddings_with_face_recognition(image_path: str) -> list[DetectedFace]:
    ensure_face_recognition()

    image = face_recognition.load_image_file(image_path)
    locations = face_recognition.face_locations(image, model=settings.FACE_DETECTION_MODEL)
    encodings = face_recognition.face_encodings(image, locations)

    results: list[DetectedFace] = []
    for location, encoding in zip(locations, encodings):
        top, right, bottom, left = location
        results.append(
            DetectedFace(
                embedding_vector=[float(value) for value in encoding.tolist()],
                face_location={
                    "top": int(top),
                    "right": int(right),
                    "bottom": int(bottom),
                    "left": int(left),
                },
            )
        )

    return results


def extract_embeddings_with_deepface(image_path: str) -> list[DetectedFace]:
    ensure_deepface()

    try:
        representations = DeepFace.represent(
            img_path=image_path,
            model_name=settings.DEEPFACE_MODEL,
            detector_backend=settings.DEEPFACE_DETECTOR_BACKEND,
            enforce_detection=True,
        )

    except ValueError as exc:
        if "face could not be detected" in str(exc).lower():
            return []
        raise

    results: list[DetectedFace] = []
    for representation in representations:
        embedding = _normalise_embedding(representation["embedding"])
        area = representation.get("facial_area") or {}
        results.append(
            DetectedFace(
                embedding_vector=embedding,
                face_location={
                    "top": int(area.get("y", 0)),
                    "right": int(area.get("x", 0) + area.get("w", 0)),
                    "bottom": int(area.get("y", 0) + area.get("h", 0)),
                    "left": int(area.get("x", 0)),
                },
            )
        )

    return results


def embedding_model_key() -> str:
    provider = settings.FACE_ENGINE_PROVIDER.lower()
    if provider == "auto":
        provider = "face_recognition" if face_recognition is not None else "deepface"
    if provider == "face_recognition":
        ensure_face_recognition()
        return "face_recognition:dlib-v1"
    if provider == "deepface":
        ensure_deepface()
        return f"deepface:{settings.DEEPFACE_MODEL}:{settings.DEEPFACE_DETECTOR_BACKEND}"
    raise FaceEngineUnavailable("Use face_recognition or deepface for identity matching. OpenCV pixel matching is disabled.")


def extract_embeddings(image_path: str) -> list[DetectedFace]:
    model = embedding_model_key()
    extractor = (extract_embeddings_with_face_recognition
                 if model.startswith("face_recognition:") else extract_embeddings_with_deepface)
    faces = extractor(image_path)
    if faces:
        return faces
    # Camera images can be stored sideways even without an EXIF orientation tag.
    # Retry upright orientations; never substitute a whole-image embedding.
    with Image.open(image_path) as image:
        width, height = image.size
        for angle in (90, 180, 270):
            with NamedTemporaryFile(suffix=".jpg") as rotated:
                image.convert("RGB").rotate(angle, expand=True).save(rotated, format="JPEG")
                rotated.flush()
                faces = extractor(rotated.name)
            if faces:
                for face in faces:
                    box = face.face_location
                    left, top, right, bottom = (box["left"], box["top"], box["right"], box["bottom"])
                    if angle == 90:
                        bounds = (width - bottom, left, width - top, right)
                    elif angle == 180:
                        bounds = (width - right, height - bottom, width - left, height - top)
                    else:
                        bounds = (top, height - right, bottom, height - left)
                    face.face_location = dict(zip(("left", "top", "right", "bottom"), bounds))
                return faces
    return []


@contextmanager
def local_image_path(image):
    """Support both local storage and remote storage without relying on .path."""
    with NamedTemporaryFile(suffix=Path(image.name).suffix or ".jpg") as temporary:
        with image.open("rb") as source:
            for chunk in source.chunks():
                temporary.write(chunk)
        temporary.flush()
        with Image.open(temporary.name) as source:
            upright = ImageOps.exif_transpose(source).convert("RGB")
        upright.save(temporary.name, format="JPEG", quality=95)
        yield temporary.name


def euclidean_distance(source: list[float], target: list[float]) -> float:
    if len(source) != len(target):
        raise ValueError("Embeddings must share the same length.")

    return math.sqrt(sum((left - right) ** 2 for left, right in zip(source, target)))


def matching_threshold() -> float:
    """Use the recognition model's threshold for the actual embedding metric."""
    if settings.FACE_MATCH_THRESHOLD is not None:
        threshold = settings.FACE_MATCH_THRESHOLD
    elif embedding_model_key().startswith("deepface:"):
        # DeepFace vectors are L2-normalized above; raw-Euclidean/cosine cutoffs
        # must not be applied to their normalized Euclidean distance.
        from deepface.modules.verification import find_threshold
        threshold = find_threshold(settings.DEEPFACE_MODEL, "euclidean_l2")
    else:
        threshold = 0.6
    if not math.isfinite(threshold) or threshold <= 0:
        raise FaceEngineUnavailable("Face matching threshold must be a positive finite number.")
    return threshold


def similarity_from_distance(distance: float, threshold: float) -> float:
    if threshold <= 0:
        return 0.0
    return max(0.0, round((1 - (distance / threshold)) * 100, 2))


def find_matches(query_embedding: list[float], candidate_embeddings, threshold: float):
    matches = []

    for candidate in candidate_embeddings:
        if len(query_embedding) != len(candidate.embedding_vector):
            continue
        distance = euclidean_distance(query_embedding, candidate.embedding_vector)
        if distance <= threshold:
            matches.append(
                {
                    "embedding": candidate,
                    "distance": distance,
                    "similarity": similarity_from_distance(distance, threshold),
                }
            )

    return sorted(matches, key=lambda item: item["distance"])
