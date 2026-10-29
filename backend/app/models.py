import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Photographer(Base):
    __tablename__ = "photographers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supabase_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), unique=True, index=True, nullable=True
    )
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    google_oauth_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    events: Mapped[list["Event"]] = relationship(back_populates="photographer")


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    photographer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("photographers.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(100), index=True)
    drive_folder_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_type: Mapped[str] = mapped_column(String(50), default="direct")
    status: Mapped[str] = mapped_column(String(50), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    photographer: Mapped["Photographer"] = relationship(back_populates="events")
    photos: Mapped[list["Photo"]] = relationship(back_populates="event")
    search_sessions: Mapped[list["SearchSession"]] = relationship(back_populates="event")


class Photo(Base):
    __tablename__ = "photos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id"), index=True)
    drive_file_id: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)
    drive_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    storage_provider: Mapped[str] = mapped_column(String(50), default="drive")
    storage_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    thumbnail_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    filename: Mapped[str] = mapped_column(String(512))
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scene_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_tags: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    quality_flags: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    processing_status: Mapped[str] = mapped_column(String(50), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    event: Mapped["Event"] = relationship(back_populates="photos")
    face_embeddings: Mapped[list["FaceEmbedding"]] = relationship(back_populates="photo")


class FaceEmbedding(Base):
    __tablename__ = "face_embeddings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    photo_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("photos.id"), index=True)
    embedding = mapped_column(Vector(512))
    face_box: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    photo: Mapped["Photo"] = relationship(back_populates="face_embeddings")


class SearchSession(Base):
    __tablename__ = "search_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id"), index=True)
    guest_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    guest_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    guest_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    consented_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    match_count: Mapped[int] = mapped_column(Integer, default=0)
    searched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    event: Mapped["Event"] = relationship(back_populates="search_sessions")
