import uuid
import pytest
from app.config import settings
from app.schemas import slugify, normalize_drive_folder_id
from app.photo_access import create_photo_access_token, verify_photo_access_token
from app.services.faces import decode_image
from fastapi import HTTPException


def test_app_name_and_version():
    assert "NovusGrid" in settings.app_name
    assert settings.app_version == "0.1.0"


def test_slugify_normalization():
    assert slugify("Annual College Convocation 2026!") == "annual-college-convocation-2026"
    assert slugify("NovusGrid_Studio  Shoot#99") == "novusgrid-studio-shoot99"
    assert slugify("   wedding---reception   ") == "wedding-reception"


def test_drive_folder_normalization():
    full_url = "https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ_123"
    assert normalize_drive_folder_id(full_url) == "1aBcDeFgHiJkLmNoPqRsTuVwXyZ_123"
    assert normalize_drive_folder_id("plain_folder_id_456/") == "plain_folder_id_456"


def test_photo_access_token_tampering():
    event_id = uuid.uuid4()
    photo_id = uuid.uuid4()
    session_id = uuid.uuid4()

    valid_token = create_photo_access_token(event_id, photo_id, session_id)
    # Valid verification passes without error
    verify_photo_access_token(valid_token, event_id, photo_id)

    # Tampered token fails
    tampered_token = valid_token[:-4] + "abcd"
    with pytest.raises(HTTPException) as exc_info:
        verify_photo_access_token(tampered_token, event_id, photo_id)
    assert exc_info.value.status_code == 403


def test_decode_image_rejects_corrupted_data():
    with pytest.raises(ValueError, match="not a valid image"):
        decode_image(b"this is definitely not a real image stream")

