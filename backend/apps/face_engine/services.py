from dataclasses import dataclass
import math

from django.conf import settings

try:
    import cv2
except ImportError:  # pragma: no cover - handled at runtime
    cv2 = None

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


def ensure_opencv() -> None:
    if cv2 is None:
        raise FaceEngineUnavailable("opencv-python is not installed.")


def ensure_face_recognition() -> None:
    if face_recognition is None:
        raise FaceEngineUnavailable(
            "face_recognition is not installed. Install the native AI requirements or use the OpenCV fallback."
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


def _build_opencv_embedding(face_region) -> list[float]:
    ensure_numpy()
    face = cv2.resize(face_region, (16, 16), interpolation=cv2.INTER_AREA)
    face = cv2.equalizeHist(face)
    face = face.astype("float32") / 255.0
    return _normalise_embedding(face.flatten())


def _load_opencv_detector():
    ensure_opencv()
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    detector = cv2.CascadeClassifier(cascade_path)
    if detector.empty():
        raise FaceEngineUnavailable("OpenCV Haar cascade detector could not be loaded.")
    return detector


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

    representations = DeepFace.represent(
        img_path=image_path,
        model_name=getattr(settings, "DEEPFACE_MODEL", "ArcFace"),
        detector_backend=getattr(settings, "DEEPFACE_DETECTOR_BACKEND", "opencv"),
        enforce_detection=False,
    )

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


def extract_embeddings_with_opencv(image_path: str) -> list[DetectedFace]:
    ensure_opencv()
    ensure_numpy()

    detector = _load_opencv_detector()
    image = cv2.imread(image_path)
    if image is None:
        raise FaceEngineUnavailable("OpenCV could not read the supplied image.")

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    detections = detector.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(48, 48))

    results: list[DetectedFace] = []
    for x, y, width, height in detections:
        face_region = gray[y : y + height, x : x + width]
        results.append(
            DetectedFace(
                embedding_vector=_build_opencv_embedding(face_region),
                face_location={
                    "top": int(y),
                    "right": int(x + width),
                    "bottom": int(y + height),
                    "left": int(x),
                },
            )
        )

    if results or not settings.FACE_ENGINE_FALLBACK_TO_IMAGE:
        return results

    height, width = gray.shape
    return [
        DetectedFace(
            embedding_vector=_build_opencv_embedding(gray),
            face_location={
                "top": 0,
                "right": int(width),
                "bottom": int(height),
                "left": 0,
            },
        )
    ]


def extract_embeddings(image_path: str) -> list[DetectedFace]:
    provider = settings.FACE_ENGINE_PROVIDER.lower()

    if provider == "face_recognition":
        return extract_embeddings_with_face_recognition(image_path)

    if provider == "deepface":
        return extract_embeddings_with_deepface(image_path)

    if provider == "opencv":
        return extract_embeddings_with_opencv(image_path)

    if provider == "auto":
        if face_recognition is not None:
            return extract_embeddings_with_face_recognition(image_path)
        if DeepFace is not None:
            return extract_embeddings_with_deepface(image_path)
        return extract_embeddings_with_opencv(image_path)

    raise FaceEngineUnavailable(f"Unsupported face engine provider: {settings.FACE_ENGINE_PROVIDER}")


def euclidean_distance(source: list[float], target: list[float]) -> float:
    if len(source) != len(target):
        raise ValueError("Embeddings must share the same length.")

    return math.sqrt(sum((left - right) ** 2 for left, right in zip(source, target)))


def similarity_from_distance(distance: float, threshold: float) -> float:
    if threshold <= 0:
        return 0.0
    return max(0.0, round((1 - (distance / threshold)) * 100, 2))


def find_matches(query_embedding: list[float], candidate_embeddings, threshold: float):
    matches = []

    for candidate in candidate_embeddings:
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
