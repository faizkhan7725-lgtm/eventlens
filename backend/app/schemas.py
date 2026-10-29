import re
import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


def slugify(value: str) -> str:
    slug = value.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_-]+", "-", slug)
    return slug.strip("-")[:100]


def normalize_drive_folder_id(value: str | None) -> str | None:
    if not value:
        return None
    candidate = value.strip()
    match = re.search(r"/folders/([a-zA-Z0-9_-]+)", candidate)
    if match:
        return match.group(1)
    return candidate.rstrip("/")


class SyncProfileRequest(BaseModel):
    provider_token: str | None = None
    provider_refresh_token: str | None = None


class PhotographerResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    has_drive_access: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class EventCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    slug: str | None = Field(default=None, max_length=100)
    source_type: str = Field(default="direct", max_length=50)
    drive_folder_id: str | None = Field(default=None, max_length=255)

    @field_validator("slug", mode="before")
    @classmethod
    def normalize_slug(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        return slugify(value)

    @field_validator("drive_folder_id", mode="before")
    @classmethod
    def normalize_drive_folder(cls, value: str | None) -> str | None:
        return normalize_drive_folder_id(value)


class EventSearchSessionResponse(BaseModel):
    id: uuid.UUID
    guest_name: str | None = None
    guest_phone: str | None = None
    guest_email: str | None = None
    match_count: int = 0
    searched_at: datetime

    model_config = {"from_attributes": True}


class EventResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    source_type: str = "direct"
    drive_folder_id: str | None = None
    status: str
    photos_total: int = 0
    photos_indexed: int = 0
    photos_pending: int = 0
    photos_processing: int = 0
    photos_failed: int = 0
    search_count: int = 0
    last_searched_at: datetime | None = None
    recent_searches: list[EventSearchSessionResponse] = Field(default_factory=list)
    public_url: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DashboardStatsResponse(BaseModel):
    events_count: int = 0
    ready_events_count: int = 0
    photos_total: int = 0
    photos_indexed: int = 0
    searches_total: int = 0
    matches_total: int = 0


class GuestSearchResponse(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    event_name: str
    guest_name: str | None = None
    guest_phone: str | None = None
    guest_email: str | None = None
    match_count: int = 0
    searched_at: datetime


class EventListResponse(BaseModel):
    stats: DashboardStatsResponse
    events: list[EventResponse]
    guest_searches: list[GuestSearchResponse] = Field(default_factory=list)


class EventSyncResponse(BaseModel):
    scanned: int
    created: int
    updated: int
    deleted: int
    queued: int
    photos_total: int


class EventReindexResponse(BaseModel):
    queued: int
    reset: int
    photos_total: int


class DriveFolderResponse(BaseModel):
    id: str
    name: str


class DriveFolderListResponse(BaseModel):
    current_folder_id: str
    current_folder_name: str
    parent_folder_id: str | None = None
    folders: list[DriveFolderResponse]


class PublicEventResponse(BaseModel):
    name: str
    slug: str
    photos_indexed: int
    ready: bool


class PublicPhotoResponse(BaseModel):
    id: uuid.UUID
    access_token: str

    model_config = {"from_attributes": True}


class PublicSearchResponse(BaseModel):
    session_id: uuid.UUID
    match_count: int
    photos: list[PublicPhotoResponse]


class PhotoUploadItemResponse(BaseModel):
    id: uuid.UUID
    filename: str
    file_size_bytes: int | None = None
    processing_status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PhotoUploadResponse(BaseModel):
    uploaded_count: int
    photos: list[PhotoUploadItemResponse]
