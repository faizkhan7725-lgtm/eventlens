from __future__ import annotations

from functools import lru_cache
from io import BytesIO

import cv2
import numpy as np
from insightface.app import FaceAnalysis
from PIL import Image, UnidentifiedImageError

from app.config import settings


@lru_cache(maxsize=4)
def face_analysis(det_size: int | None = None) -> FaceAnalysis:
    size = det_size or settings.face_detection_size
    app = FaceAnalysis(
        name=settings.face_model_name,
        providers=["CPUExecutionProvider"],
    )
    app.prepare(ctx_id=0, det_size=(size, size))
    return app


def decode_image(image_bytes: bytes) -> np.ndarray:
    try:
        with Image.open(BytesIO(image_bytes)) as source:
            width, height = source.size
            if width <= 0 or height <= 0:
                raise ValueError("Image dimensions are invalid")
            if width * height > settings.max_image_pixels:
                raise ValueError("Image dimensions are too large")
            if source.format not in {"JPEG", "PNG", "WEBP"}:
                raise ValueError("Unsupported image format")
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("Uploaded file is not a valid image") from exc

    array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Downloaded file could not be decoded as an image")
    return image


def _orient_for_detection(image: np.ndarray) -> np.ndarray:
    """Rotate landscape selfies to portrait so face fills more of the det_size square.

    Mobile cameras often encode images in landscape (width > height) even when
    the phone is held portrait. InsightFace uses a square det_size window, so a
    portrait crop gives the face more pixels and improves detection accuracy,
    especially for small or off-angle faces from mobile cameras.
    """
    h, w = image.shape[:2]
    if w > h:
        image = cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)
    return image


def extract_faces(image_bytes: bytes):
    image = decode_image(image_bytes)
    # Orient portrait for better mobile selfie detection
    image = _orient_for_detection(image)

    faces = face_analysis().get(image)
    if faces:
        return faces

    fallback_size = settings.face_detection_fallback_size
    if fallback_size > settings.face_detection_size:
        return face_analysis(fallback_size).get(image)

    return faces


def primary_face_embedding(image_bytes: bytes) -> list[float]:
    faces = extract_faces(image_bytes)
    if not faces:
        raise ValueError("No face detected")

    # Prefer the largest face when multiple are present in the selfie.
    def face_area(face) -> float:
        bbox = getattr(face, "bbox", None)
        if bbox is None:
            return 0.0
        return max(0.0, float(bbox[2] - bbox[0])) * max(0.0, float(bbox[3] - bbox[1]))

    face = max(faces, key=face_area)
    embedding = getattr(face, "embedding", None)
    if embedding is None:
        raise ValueError("No usable face embedding produced")
    return np.asarray(embedding, dtype=np.float32).tolist()
