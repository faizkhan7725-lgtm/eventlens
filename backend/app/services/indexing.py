from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

import numpy as np
from fastapi import HTTPException, status
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Event, FaceEmbedding, Photo, Photographer
from app.services import drive as drive_service
from app.services import faces
from app.services.ai_curation import analyze_photo_with_gemini
from app.services.storage import get_storage_provider

logger = logging.getLogger(__name__)


@dataclass
class ReindexResult:
    queued: int
    reset: int
    photos_total: int


@dataclass
class QueueResult:
    queued: int


def queue_event_reindex(db: Session, photographer: Photographer, event: Event) -> ReindexResult:
    photos = db.query(Photo).filter(Photo.event_id == event.id).order_by(Photo.created_at.asc()).all()
    if not photos:
        return ReindexResult(queued=0, reset=0, photos_total=0)

    photo_ids = [photo.id for photo in photos]
    db.execute(delete(FaceEmbedding).where(FaceEmbedding.photo_id.in_(photo_ids)))

    for photo in photos:
        photo.processing_status = "queued"
        photo.processed_at = None
        db.flush()

    db.commit()

    _enqueue_photos(photos)

    return ReindexResult(
        queued=len(photos),
        reset=len(photos),
        photos_total=len(photos),
    )


def queue_pending_event_photos(db: Session, event: Event) -> QueueResult:
    photos = (
        db.query(Photo)
        .filter(Photo.event_id == event.id, Photo.processing_status.in_(["pending", "failed"]))
        .order_by(Photo.created_at.asc())
        .all()
    )
    if not photos:
        return QueueResult(queued=0)

    for photo in photos:
        photo.processing_status = "queued"
        photo.processed_at = None
        db.flush()

    db.commit()
    _enqueue_photos(photos)
    return QueueResult(queued=len(photos))


def _enqueue_photos(photos: list[Photo]) -> None:
    try:
        from app.worker import index_photo_task

        for photo in photos:
            index_photo_task.delay(str(photo.id))
    except Exception as exc:
        logger.exception("Failed to enqueue photo indexing jobs")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Indexing queue is unavailable. Start the Celery worker and try again.",
        ) from exc


def process_photo_indexing(photo_id: str) -> None:
    db = SessionLocal()
    try:
        photo = db.query(Photo).filter(Photo.id == uuid.UUID(photo_id)).first()
        if photo is None:
            logger.warning("Indexing skipped because photo %s was not found", photo_id)
            return

        event = db.query(Event).filter(Event.id == photo.event_id).first()
        if event is None:
            logger.warning("Indexing skipped because event %s was not found", photo.event_id)
            photo.processing_status = "failed"
            db.commit()
            return

        photographer = db.query(Photographer).filter(Photographer.id == event.photographer_id).first()
        if photographer is None:
            logger.warning("Indexing skipped because photographer %s was not found", event.photographer_id)
            photo.processing_status = "failed"
            db.commit()
            return

        photo.processing_status = "processing"
        db.commit()

        try:
            _run_face_indexing(photo, photographer, db)
        except Exception:
            identifier = photo.storage_key or photo.drive_file_id or str(photo.id)
            logger.exception("Photo indexing failed for %s", identifier)
            photo.processing_status = "failed"
            photo.processed_at = None
            db.commit()
            raise

        photo.processing_status = "done"
        photo.processed_at = datetime.now(timezone.utc)
        db.commit()
    finally:
        db.close()


def _run_face_indexing(photo: Photo, photographer: Photographer, db: Session) -> None:
    if photo.storage_provider in ("local", "s3") and photo.storage_key:
        image_bytes = get_storage_provider().get_file(photo.storage_key)
    else:
        image_bytes = drive_service.download_photo_bytes(db, photographer, photo)

    detected_faces = faces.extract_faces(image_bytes)

    db.execute(delete(FaceEmbedding).where(FaceEmbedding.photo_id == photo.id))

    for face in detected_faces:
        embedding = getattr(face, "embedding", None)
        if embedding is None:
            continue

        bbox = getattr(face, "bbox", None)
        face_box = None
        if bbox is not None:
            face_box = {
                "x1": float(bbox[0]),
                "y1": float(bbox[1]),
                "x2": float(bbox[2]),
                "y2": float(bbox[3]),
            }

        db.add(
            FaceEmbedding(
                photo_id=photo.id,
                embedding=np.asarray(embedding, dtype=np.float32).tolist(),
                face_box=face_box,
            )
        )

    # Content Curation & AI scene analysis
    try:
        ai_meta = analyze_photo_with_gemini(image_bytes)
        photo.scene_description = ai_meta.get("scene_description")
        photo.ai_tags = ai_meta.get("tags")
        photo.quality_flags = {
            "is_blurry": ai_meta.get("is_blurry", False),
            "has_blink": ai_meta.get("has_blink", False),
            "quality_rating": ai_meta.get("quality_rating", "good"),
        }
    except Exception as exc:
        logger.warning("Curation metadata skipped: %s", exc)

    db.commit()
