import uuid
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Photo, SearchSession
from app.photo_access import create_photo_access_token, verify_photo_access_token
from app.rate_limit import client_ip, public_search_limiter
from app.schemas import PublicEventResponse, PublicPhotoResponse, PublicSearchResponse
from app.services import drive as drive_service
from app.services import public_search
from app.services.storage import get_storage_provider

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/events/{slug}", response_model=PublicEventResponse)
def get_public_event(slug: str, db: Session = Depends(get_db)):
    event = public_search.get_public_event_by_slug(db, slug)

    photos_indexed = (
        db.query(func.count(Photo.id))
        .filter(Photo.event_id == event.id, Photo.processing_status == "done")
        .scalar()
        or 0
    )

    return {
        "name": event.name,
        "slug": event.slug,
        "photos_indexed": photos_indexed,
        "ready": photos_indexed > 0,
    }


@router.post("/events/{slug}/search", response_model=PublicSearchResponse)
async def search_public_event(
    request: Request,
    slug: str,
    guest_name: str = Form("Guest", max_length=255),
    guest_phone: str | None = Form(None),
    guest_email: str | None = Form(None),
    privacy_consent: bool = Form(True),
    selfie: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    allowed, retry_after = public_search_limiter.check(client_ip(request))
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many searches. Please wait before trying again.",
            headers={"Retry-After": str(retry_after)},
        )
    if not privacy_consent:
        raise HTTPException(status_code=400, detail="Privacy consent is required")
    clean_name = guest_name.strip() if guest_name and guest_name.strip() else "Guest"
    clean_phone = guest_phone.strip() if guest_phone and guest_phone.strip() else None
    clean_email = guest_email.strip().lower() if guest_email and guest_email.strip() else None

    if any(ord(char) < 32 for char in clean_name):
        raise HTTPException(status_code=400, detail="Enter a valid name")
    if clean_phone and not all(char.isdigit() or char in "+-() " for char in clean_phone):
        raise HTTPException(status_code=400, detail="Enter a valid phone number")
    if clean_email and (clean_email.count("@") != 1 or "." not in clean_email.rsplit("@", 1)[-1]):
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    if selfie.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Upload a JPEG, PNG, or WebP image")
    if selfie.size is not None and selfie.size > settings.max_selfie_bytes:
        raise HTTPException(status_code=413, detail="Selfie file is too large")

    event = public_search.get_public_event_by_slug(db, slug)
    selfie_bytes = await selfie.read(settings.max_selfie_bytes + 1)
    await selfie.close()
    if len(selfie_bytes) > settings.max_selfie_bytes:
        raise HTTPException(status_code=413, detail="Selfie file is too large")
    return public_search.search_event_photos(
        db,
        event,
        selfie_bytes,
        clean_name,
        clean_phone,
        clean_email,
    )


@router.get("/events/{slug}/search-moments", response_model=PublicSearchResponse)
def search_event_moments(
    request: Request,
    slug: str,
    q: str,
    db: Session = Depends(get_db),
):
    allowed, retry_after = public_search_limiter.check(client_ip(request))
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many searches. Please wait before trying again.",
            headers={"Retry-After": str(retry_after)},
        )
    query_str = q.strip().lower()
    if not query_str or len(query_str) < 2:
        raise HTTPException(status_code=400, detail="Search query must be at least 2 characters")

    event = public_search.get_public_event_by_slug(db, slug)

    pattern = f"%{query_str}%"
    matched_photos = (
        db.query(Photo)
        .filter(
            Photo.event_id == event.id,
            Photo.processing_status == "done",
            (Photo.scene_description.ilike(pattern) | Photo.filename.ilike(pattern)),
        )
        .limit(settings.max_search_results)
        .all()
    )

    search_session = SearchSession(
        event_id=event.id,
        guest_name=f"Search: {query_str[:40]}",
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


def _authorized_photo(slug: str, photo_id: uuid.UUID, token: str, db: Session) -> Photo:
    event = public_search.get_public_event_by_slug(db, slug)
    photo = (
        db.query(Photo)
        .filter(Photo.id == photo_id, Photo.event_id == event.id, Photo.processing_status == "done")
        .first()
    )
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo not found")
    if photo.storage_provider == "drive" and not photo.drive_url:
        raise HTTPException(status_code=404, detail="Photo not found")
    if photo.storage_provider in ("local", "s3", "supabase") and not photo.storage_key:
        raise HTTPException(status_code=404, detail="Photo not found")
    verify_photo_access_token(token, event.id, photo.id)
    return photo


@router.get("/events/{slug}/photos/{photo_id}/download")
def download_public_photo(slug: str, photo_id: uuid.UUID, token: str, db: Session = Depends(get_db)):
    photo = _authorized_photo(slug, photo_id, token, db)
    provider = get_storage_provider()
    if photo.storage_provider == "supabase" and photo.storage_key and hasattr(provider, "get_public_url"):
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=provider.get_public_url(photo.storage_key), status_code=307)

    if photo.storage_provider in ("local", "s3", "supabase") and photo.storage_key:
        image_bytes = provider.get_file(photo.storage_key)
        media_type = "image/jpeg"
        if photo.filename.lower().endswith(".png"):
            media_type = "image/png"
        elif photo.filename.lower().endswith(".webp"):
            media_type = "image/webp"
    else:
        image_bytes = drive_service.download_photo_bytes(db, photo.event.photographer, photo)
        media_type = drive_service.guess_photo_content_type(photo)
    filename = quote(photo.filename, safe="")
    return Response(
        content=image_bytes,
        media_type=media_type,
        headers={
            "Cache-Control": "private, no-store",
            "Content-Disposition": f"attachment; filename*=UTF-8''{filename}",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/events/{slug}/photos/{photo_id}/thumbnail")
def preview_public_photo(slug: str, photo_id: uuid.UUID, token: str, db: Session = Depends(get_db)):
    photo = _authorized_photo(slug, photo_id, token, db)
    provider = get_storage_provider()

    if photo.storage_provider == "supabase" and hasattr(provider, "get_public_url"):
        key = photo.thumbnail_key or photo.storage_key
        if key:
            from fastapi.responses import RedirectResponse
            return RedirectResponse(url=provider.get_public_url(key), status_code=307)

    if photo.thumbnail_key:
        try:
            image_bytes = provider.get_file(photo.thumbnail_key)
            return Response(
                content=image_bytes,
                media_type="image/webp",
                headers={"Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff"},
            )
        except Exception:
            pass

    if photo.storage_provider in ("local", "s3", "supabase") and photo.storage_key:
        image_bytes = provider.get_file(photo.storage_key)
        return Response(
            content=image_bytes,
            media_type="image/jpeg",
            headers={"Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff"},
        )

    photographer = photo.event.photographer
    try:
        image_bytes = drive_service.download_photo_bytes(db, photographer, photo)
    except HTTPException as exc:
        if exc.status_code == 404:
            drive_service.delete_photo_record(db, photo)
            raise HTTPException(status_code=404, detail="Photo was removed from Google Drive.") from exc
        raise
    return Response(
        content=image_bytes,
        media_type=drive_service.guess_photo_content_type(photo),
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )
