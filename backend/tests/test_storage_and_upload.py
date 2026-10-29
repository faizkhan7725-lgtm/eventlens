import asyncio
import tempfile
import uuid
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

import httpx
import pytest
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import get_current_photographer
from app.database import Base, get_db
from app.main import app
from app.models import Event, Photographer, Photo, SearchSession
from app.schemas import EventCreate
from app.services.ai_curation import analyze_photo_with_gemini
from app.services.storage import (
    LocalStorageProvider,
    generate_storage_key,
    generate_thumbnail,
    validate_image_bytes,
)


def _create_sample_image(width: int = 800, height: int = 600, fmt: str = "JPEG") -> bytes:
    img = Image.new("RGB", (width, height), color=(100, 150, 200))
    buf = BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def test_validate_image_bytes_valid_and_invalid():
    # Valid JPEG
    jpeg_bytes = _create_sample_image(400, 300, "JPEG")
    w, h, fmt = validate_image_bytes(jpeg_bytes)
    assert w == 400 and h == 300 and fmt == "JPEG"

    # Valid PNG
    png_bytes = _create_sample_image(200, 200, "PNG")
    w, h, fmt = validate_image_bytes(png_bytes)
    assert w == 200 and h == 200 and fmt == "PNG"

    # Corrupt data
    with pytest.raises(ValueError, match="could not be identified"):
        validate_image_bytes(b"not an image stream")


def test_generate_thumbnail_resizing_and_webp():
    orig_bytes = _create_sample_image(1200, 800, "JPEG")
    thumb_bytes = generate_thumbnail(orig_bytes, max_width=400)

    # Check that thumb_bytes is a valid image and max_width is respected
    with Image.open(BytesIO(thumb_bytes)) as thumb:
        assert thumb.format == "WEBP"
        assert thumb.width <= 400
        # Aspect ratio should be maintained (1200:800 = 3:2 -> 400:266)
        assert abs(thumb.height - int(400 * 800 / 1200)) <= 2


def test_local_storage_provider_lifecycle_and_traversal_protection():
    with tempfile.TemporaryDirectory() as temp_dir:
        provider = LocalStorageProvider(base_dir=temp_dir)
        test_key = "events/test-uuid/photo_123.jpg"
        test_data = b"binary photo data sample"

        # Check doesn't exist
        assert not provider.exists(test_key)

        # Save file
        saved_key = provider.save_file(test_data, test_key)
        assert saved_key == test_key
        assert provider.exists(test_key)

        # Get file
        retrieved = provider.get_file(test_key)
        assert retrieved == test_data

        # Delete file
        assert provider.delete_file(test_key)
        assert not provider.exists(test_key)

        # Path traversal rejection
        with pytest.raises(ValueError, match="Path traversal"):
            provider.save_file(test_data, "../../outside_file.txt")

        with pytest.raises(ValueError, match="Path traversal"):
            provider.get_file("../../outside_file.txt")


def test_generate_storage_key_format():
    event_id = uuid.uuid4()
    photo_key = generate_storage_key(event_id, "my wedding shoot.jpg", is_thumbnail=False)
    assert f"events/{event_id}/photo_" in photo_key
    assert photo_key.endswith(".jpg")
    assert " " not in photo_key

    thumb_key = generate_storage_key(event_id, "my wedding shoot.jpg", is_thumbnail=True)
    assert f"events/{event_id}/thumb_" in thumb_key
    assert thumb_key.endswith(".webp")


def test_event_create_schema_direct_and_drive():
    # Direct event (default) does not require drive_folder_id
    direct_event = EventCreate(name="Summer Fest 2026", source_type="direct")
    assert direct_event.name == "Summer Fest 2026"
    assert direct_event.source_type == "direct"
    assert direct_event.drive_folder_id is None

    # Drive event normalizes drive_folder_id
    drive_event = EventCreate(
        name="Corporate Gala",
        source_type="drive",
        drive_folder_id="https://drive.google.com/drive/folders/abc123XYZ",
    )
    assert drive_event.source_type == "drive"
    assert drive_event.drive_folder_id == "abc123XYZ"


def test_ai_curation_fallback_when_no_api_key():
    sample_img = _create_sample_image(200, 200, "JPEG")
    # Calling analyze_photo_with_gemini without GEMINI_API_KEY set must return safe default without error ($0 cost)
    result = analyze_photo_with_gemini(sample_img)
    assert "scene_description" in result
    assert "tags" in result
    assert "is_blurry" in result
    assert "quality_rating" in result
    assert result["quality_rating"] == "good"


def test_upload_photos_api_endpoint():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Photographer.__table__.create(engine)
    Event.__table__.create(engine)
    Photo.__table__.create(engine)

    TestingSessionLocal = sessionmaker(bind=engine)
    db = TestingSessionLocal()

    photographer = Photographer(
        id=uuid.uuid4(),
        name="Studio Tester",
        email="studio@example.com",
    )
    db.add(photographer)

    event = Event(
        id=uuid.uuid4(),
        photographer_id=photographer.id,
        name="Annual Gala 2026",
        slug="annual-gala-2026",
        source_type="direct",
        status="active",
    )
    db.add(event)
    db.commit()

    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    def override_get_current_photographer():
        return photographer

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_photographer] = override_get_current_photographer

    try:
        sample_img = _create_sample_image(300, 200, "JPEG")

        async def run_upload():
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app), base_url="http://test"
            ) as client:
                files = [
                    ("files", ("event_moment_1.jpg", sample_img, "image/jpeg")),
                ]
                with patch("app.worker.index_photo_task.delay") as mock_delay:
                    mock_delay.return_value = None
                    return await client.post(
                        f"/api/events/{event.id}/photos/upload",
                        files=files,
                    )

        response = asyncio.run(run_upload())
        assert response.status_code == 201
        data = response.json()
        assert data["uploaded_count"] == 1
        assert data["photos"][0]["filename"] == "event_moment_1.jpg"
        assert data["photos"][0]["processing_status"] in ("queued", "pending")
    finally:
        app.dependency_overrides.clear()
        db.close()
