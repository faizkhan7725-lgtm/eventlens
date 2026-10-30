from __future__ import annotations

from functools import lru_cache
from io import BytesIO

import cv2
import numpy as np
from insightface.app import FaceAnalysis
from PIL import Image, ImageOps, UnidentifiedImageError

from app.config import settings


@lru_cache(maxsize=4)
def face_analysis(det_size: int | None = None) -> FaceAnalysis:
    size = det_size or settings.face_detection_size
    app = FaceAnalysis(
        name=settings.face_model_name,
        allowed_modules=["detection", "recognition"],
        providers=["CPUExecutionProvider"],
    )
    app.prepare(ctx_id=-1, det_size=(size, size))
    return app


def decode_image(image_bytes: bytes) -> np.ndarray:
    """Decodes raw image bytes into an upright BGR OpenCV array with EXIF orientation transposed."""
    try:
        with Image.open(BytesIO(image_bytes)) as source:
            source = ImageOps.exif_transpose(source)
            width, height = source.size
            if width <= 0 or height <= 0:
                raise ValueError("Image dimensions are invalid")
            if width * height > settings.max_image_pixels:
                raise ValueError("Image dimensions are too large")
            if source.mode != "RGB":
                source = source.convert("RGB")
            rgb = np.array(source)
            return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("Uploaded file is not a valid image") from exc


def extract_faces(image_bytes: bytes):
    image = decode_image(image_bytes)

    # 1. Primary detection with standard det_size
    faces = face_analysis().get(image)
    if faces:
        return faces

    # 2. Try higher resolution detection if configured
    fallback_size = settings.face_detection_fallback_size
    if fallback_size > settings.face_detection_size:
        faces = face_analysis(fallback_size).get(image)
        if faces:
            return faces

    # 3. Fallback: If camera or browser stripped EXIF orientation, attempt 90, 270, 180 deg rotations
    for rot in (cv2.ROTATE_90_CLOCKWISE, cv2.ROTATE_90_COUNTERCLOCKWISE, cv2.ROTATE_180):
        rotated = cv2.rotate(image, rot)
        faces = face_analysis().get(rotated)
        if faces:
            return faces

    return []


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
