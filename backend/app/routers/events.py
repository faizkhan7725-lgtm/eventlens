import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.auth import get_current_photographer
from app.config import settings
from app.database import get_db
from app.models import Photo, Photographer
from app.schemas import (
    DriveFolderListResponse,
    EventCreate,
    EventListResponse,
    EventReindexResponse,
    EventResponse,
    EventSyncResponse,
    PhotoUploadItemResponse,
    PhotoUploadResponse,
)
from app.services import drive as drive_service
from app.services import events as event_service
from app.services import indexing as indexing_service
from app.services.storage import generate_storage_key, generate_thumbnail, get_storage_provider, validate_image_bytes

router = APIRouter(prefix="/events", tags=["events"])


@router.get("", response_model=EventListResponse)
def list_events(
    status: str = "active",
    photographer: Photographer = Depends(get_current_photographer),
    db: Session = Depends(get_db),
):
    return event_service.list_events(db, photographer, status_filter=status)


@router.get("/drive-folders", response_model=DriveFolderListResponse)
def list_drive_folders(
    parent_id: str | None = None,
    photographer: Photographer = Depends(get_current_photographer),
    db: Session = Depends(get_db),
):
    return drive_service.list_drive_folders(db, photographer, parent_id=parent_id)


@router.post("", response_model=EventResponse, status_code=201)
def create_event(
    body: EventCreate,
    photographer: Photographer = Depends(get_current_photographer),
    db: Session = Depends(get_db),
):
    event = event_service.create_event_model(db, photographer, body)
    if event.source_type == "drive" and event.drive_folder_id:
        drive_service.sync_event_photos(db, photographer, event)
        indexing_service.queue_pending_event_photos(db, event)
    else:
        db.commit()
    return event_service.get_event(db, photographer, event.id)


@router.delete("/search-sessions/{session_id}", status_code=204)
def delete_guest_search(
    session_id: uuid.UUID,
    photographer: Photographer = Depends(get_current_photographer),
    db: Session = Depends(get_db),
):
    event_service.delete_guest_search(db, photographer, session_id)


@router.get("/{event_id}", response_model=EventResponse)
def get_event(
    event_id: uuid.UUID,
    photographer: Photographer = Depends(get_current_photographer),
    db: Session = Depends(get_db),
):
    return event_service.get_event(db, photographer, event_id)


@router.delete("/{event_id}", status_code=204)
def delete_event(
    event_id: uuid.UUID,
    photographer: Photographer = Depends(get_current_photographer),
    db: Session = Depends(get_db),
):
    event_service.archive_event(db, photographer, event_id)


@router.post("/{event_id}/restore", response_model=EventResponse)
def restore_event(
    event_id: uuid.UUID,
    photographer: Photographer = Depends(get_current_photographer),
    db: Session = Depends(get_db),
):
    return event_service.restore_event(db, photographer, event_id)


@router.delete("/{event_id}/permanent", status_code=204)
def permanently_delete_event(
    event_id: uuid.UUID,
    photographer: Photographer = Depends(get_current_photographer),
    db: Session = Depends(get_db),
):
    event_service.permanently_delete_event(db, photographer, event_id)


@router.post("/{event_id}/sync", response_model=EventSyncResponse)
def sync_event(
    event_id: uuid.UUID,
    photographer: Photographer = Depends(get_current_photographer),
    db: Session = Depends(get_db),
):
    event = event_service.get_event_model(db, photographer, event_id)
    if event.source_type != "drive" or not event.drive_folder_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sync is only available for Google Drive events.",
        )
    result = drive_service.sync_event_photos(db, photographer, event)
    queue_result = indexing_service.queue_pending_event_photos(db, event)
    return EventSyncResponse(
        scanned=result.scanned,
        created=result.created,
        updated=result.updated,
        deleted=result.deleted,
        queued=queue_result.queued,
        photos_total=result.photos_total,
    )


@router.post("/{event_id}/reindex", response_model=EventReindexResponse)
def reindex_event(
    event_id: uuid.UUID,
    photographer: Photographer = Depends(get_current_photographer),
    db: Session = Depends(get_db),
):
    event = event_service.get_event_model(db, photographer, event_id)
    result = indexing_service.queue_event_reindex(db, photographer, event)
    return EventReindexResponse(
        queued=result.queued,
        reset=result.reset,
        photos_total=result.photos_total,
    )


@router.post("/{event_id}/photos/upload", response_model=PhotoUploadResponse, status_code=201)
async def upload_event_photos(
    event_id: uuid.UUID,
    files: list[UploadFile] = File(...),
    photographer: Photographer = Depends(get_current_photographer),
    db: Session = Depends(get_db),
):
    event = event_service.get_event_model(db, photographer, event_id)
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No files provided")

    storage_provider = get_storage_provider()
    created_photos: list[Photo] = []

    for file in files:
        if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"Unsupported format for {file.filename}. Only JPEG, PNG, or WebP allowed.",
            )

        content = await file.read(settings.max_upload_bytes + 1)
        await file.close()

        if len(content) > settings.max_upload_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File {file.filename} exceeds maximum size limit of {settings.max_upload_bytes} bytes",
            )

        try:
            validate_image_bytes(content)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid image {file.filename}: {exc}",
            ) from exc

        # Generate storage keys
        photo_key = generate_storage_key(event.id, file.filename or "photo.jpg", is_thumbnail=False)
        thumb_key = generate_storage_key(event.id, file.filename or "photo.jpg", is_thumbnail=True)

        # Store original
        storage_provider.save_file(content, photo_key)

        # Generate and store thumbnail
        thumb_bytes = generate_thumbnail(content, max_width=400)
        storage_provider.save_file(thumb_bytes, thumb_key)

        photo = Photo(
            event_id=event.id,
            filename=file.filename or "photo.jpg",
            file_size_bytes=len(content),
            storage_provider=settings.storage_backend,
            storage_key=photo_key,
            thumbnail_key=thumb_key,
            processing_status="queued",
        )
        db.add(photo)
        created_photos.append(photo)

    db.commit()

    # Enqueue indexing tasks
    try:
        from app.worker import index_photo_task

        for photo in created_photos:
            db.refresh(photo)
            index_photo_task.delay(str(photo.id))
    except Exception:
        pass

    return PhotoUploadResponse(
        uploaded_count=len(created_photos),
        photos=[
            PhotoUploadItemResponse(
                id=p.id,
                filename=p.filename,
                file_size_bytes=p.file_size_bytes,
                processing_status=p.processing_status,
                created_at=p.created_at,
            )
            for p in created_photos
        ],
    )
