from __future__ import annotations

from collections.abc import Sequence

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Event, FaceEmbedding, Photo, SearchSession
from app.photo_access import create_photo_access_token
from app.schemas import PublicPhotoResponse, PublicSearchResponse
from app.services import faces


def get_public_event_by_slug(db: Session, slug: str) -> Event:
    event = db.query(Event).filter(Event.slug == slug, Event.status == "active").first()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return event


def search_event_photos(
    db: Session,
    event: Event,
    selfie_bytes: bytes,
    guest_name: str,
    guest_phone: str,
    guest_email: str,
) -> PublicSearchResponse:
    indexed_count = (
        db.query(Photo).filter(Photo.event_id == event.id, Photo.processing_status == "done").count()
    )
    if indexed_count == 0:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Event not ready yet. Photo indexing is still in progress.",
        )

    try:
        query_embedding = faces.primary_face_embedding(selfie_bytes)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No face detected in the uploaded selfie.",
        ) from exc

    distance = FaceEmbedding.embedding.cosine_distance(query_embedding)
    rows: Sequence[tuple[Photo, float]] = (
        db.query(Photo, distance.label("distance"))
        .join(FaceEmbedding, FaceEmbedding.photo_id == Photo.id)
        .filter(Photo.event_id == event.id, Photo.processing_status == "done", distance < settings.similarity_threshold)
        .order_by(distance.asc())
        .limit(settings.max_search_results)
        .all()
    )

    matched_photos: list[Photo] = []
    seen: set = set()
    for photo, _score in rows:
        if photo.id not in seen:
            seen.add(photo.id)
            matched_photos.append(photo)

    search_session = SearchSession(
        event_id=event.id,
        guest_name=guest_name,
        guest_phone=guest_phone,
        guest_email=guest_email,
        match_count=len(matched_photos),
    )
    db.add(search_session)
    db.commit()
    db.refresh(search_session)

    photos = [
        PublicPhotoResponse(
            id=photo.id,
            access_token=create_photo_access_token(event.id, photo.id, search_session.id),
        )
        for photo in matched_photos
    ]

    return PublicSearchResponse(
        session_id=search_session.id,
        match_count=len(photos),
        photos=photos,
    )
