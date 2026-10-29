from __future__ import annotations

import mimetypes
import os
import uuid
from abc import ABC, abstractmethod
from io import BytesIO
from pathlib import Path

from PIL import Image, UnidentifiedImageError

from app.config import settings


def validate_image_bytes(image_bytes: bytes) -> tuple[int, int, str]:
    """Validates that bytes form a valid, non-corrupted JPEG, PNG, or WebP image.

    Returns:
        (width, height, format_name)
    Raises:
        ValueError if the file is invalid, unsupported, or exceeds dimension limits.
    """
    try:
        with Image.open(BytesIO(image_bytes)) as img:
            width, height = img.size
            if width <= 0 or height <= 0:
                raise ValueError("Image dimensions must be positive")
            if width * height > settings.max_image_pixels:
                raise ValueError("Image dimensions exceed maximum allowable pixels")
            fmt = (img.format or "").upper()
            if fmt not in {"JPEG", "PNG", "WEBP"}:
                raise ValueError(f"Unsupported image format: {fmt}. Must be JPEG, PNG, or WebP.")
            return width, height, fmt
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("Uploaded file could not be identified as a valid image") from exc


def generate_thumbnail(image_bytes: bytes, max_width: int = 400) -> bytes:
    """Generates an optimized, aspect-ratio-preserved WebP thumbnail from image bytes."""
    with Image.open(BytesIO(image_bytes)) as img:
        # Convert paletted or RGBA to RGB for standard web output if needed
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            # Create a clean white background for transparent images
            bg = Image.new("RGB", img.size, (255, 255, 255))
            rgba = img.convert("RGBA")
            bg.paste(rgba, mask=rgba.split()[3])
            img = bg
        elif img.mode != "RGB":
            img = img.convert("RGB")

        width, height = img.size
        if width > max_width:
            aspect_ratio = height / width
            new_height = max(1, int(max_width * aspect_ratio))
            img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)

        output = BytesIO()
        img.save(output, format="WEBP", quality=82, method=6)
        return output.getvalue()


class StorageProvider(ABC):
    @abstractmethod
    def save_file(self, data: bytes, key: str) -> str:
        """Saves data under key and returns key or URI."""
        ...

    @abstractmethod
    def get_file(self, key: str) -> bytes:
        """Retrieves data for key."""
        ...

    @abstractmethod
    def delete_file(self, key: str) -> bool:
        """Deletes file for key."""
        ...

    @abstractmethod
    def exists(self, key: str) -> bool:
        """Checks if key exists in storage."""
        ...


class LocalStorageProvider(StorageProvider):
    def __init__(self, base_dir: Path | str | None = None):
        if base_dir is None:
            backend_dir = Path(__file__).resolve().parent.parent.parent
            self.base_dir = (backend_dir / settings.storage_local_dir).resolve()
        else:
            self.base_dir = Path(base_dir).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _safe_path(self, key: str) -> Path:
        # Normalize and prevent directory traversal
        clean_key = key.replace("\\", "/").lstrip("/")
        target_path = (self.base_dir / clean_key).resolve()
        if not target_path.is_relative_to(self.base_dir):
            raise ValueError(f"Path traversal detected: {key}")
        return target_path

    def save_file(self, data: bytes, key: str) -> str:
        path = self._safe_path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key

    def get_file(self, key: str) -> bytes:
        path = self._safe_path(key)
        if not path.is_file():
            raise FileNotFoundError(f"Storage key not found: {key}")
        return path.read_bytes()

    def delete_file(self, key: str) -> bool:
        try:
            path = self._safe_path(key)
            if path.is_file():
                path.unlink()
                return True
            return False
        except (FileNotFoundError, ValueError):
            return False

    def exists(self, key: str) -> bool:
        try:
            path = self._safe_path(key)
            return path.is_file()
        except ValueError:
            return False


class S3StorageProvider(StorageProvider):
    """S3-compatible storage provider (AWS S3, Cloudflare R2, MinIO)."""

    def __init__(self):
        self.bucket = settings.s3_bucket_name
        self.endpoint_url = settings.s3_endpoint_url or None
        self._client = None

    def _get_client(self):
        if self._client is None:
            import boto3
            from botocore.config import Config

            self._client = boto3.client(
                "s3",
                endpoint_url=self.endpoint_url,
                aws_access_key_id=settings.s3_access_key_id,
                aws_secret_access_key=settings.s3_secret_access_key,
                region_name=settings.s3_region_name if settings.s3_region_name != "auto" else None,
                config=Config(s3={"addressing_style": "virtual"}),
            )
        return self._client

    def save_file(self, data: bytes, key: str) -> str:
        client = self._get_client()
        content_type, _ = mimetypes.guess_type(key)
        content_type = content_type or "application/octet-stream"
        client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
        return key

    def get_file(self, key: str) -> bytes:
        client = self._get_client()
        response = client.get_object(Bucket=self.bucket, Key=key)
        return response["Body"].read()

    def delete_file(self, key: str) -> bool:
        try:
            client = self._get_client()
            client.delete_object(Bucket=self.bucket, Key=key)
            return True
        except Exception:
            return False

    def exists(self, key: str) -> bool:
        try:
            client = self._get_client()
            client.head_object(Bucket=self.bucket, Key=key)
            return True
        except Exception:
            return False


class SupabaseStorageProvider(StorageProvider):
    """Supabase Storage provider with public CDN acceleration and zero disk dependency."""

    def __init__(self, bucket_name: str = "event-photos"):
        self.bucket_name = bucket_name
        self.url = settings.supabase_url.rstrip("/")
        self.key = settings.supabase_service_role_key

    def save_file(self, data: bytes, key: str) -> str:
        import requests

        clean_key = key.replace("\\", "/").lstrip("/")
        content_type, _ = mimetypes.guess_type(clean_key)
        content_type = content_type or "application/octet-stream"
        endpoint = f"{self.url}/storage/v1/object/{self.bucket_name}/{clean_key}"
        res = requests.post(
            endpoint,
            headers={
                "Authorization": f"Bearer {self.key}",
                "apikey": self.key,
                "Content-Type": content_type,
                "x-upsert": "true",
            },
            data=data,
            timeout=30,
        )
        if res.status_code not in (200, 201):
            raise RuntimeError(f"Supabase storage upload failed: {res.status_code} {res.text}")
        return clean_key

    def get_file(self, key: str) -> bytes:
        import requests

        clean_key = key.replace("\\", "/").lstrip("/")
        endpoint = f"{self.url}/storage/v1/object/public/{self.bucket_name}/{clean_key}"
        res = requests.get(endpoint, timeout=30)
        if res.status_code != 200:
            res = requests.get(
                f"{self.url}/storage/v1/object/{self.bucket_name}/{clean_key}",
                headers={"Authorization": f"Bearer {self.key}", "apikey": self.key},
                timeout=30,
            )
        if res.status_code != 200:
            raise FileNotFoundError(f"Storage key not found: {key}")
        return res.content

    def get_public_url(self, key: str) -> str:
        clean_key = key.replace("\\", "/").lstrip("/")
        return f"{self.url}/storage/v1/object/public/{self.bucket_name}/{clean_key}"

    def delete_file(self, key: str) -> bool:
        import requests

        clean_key = key.replace("\\", "/").lstrip("/")
        endpoint = f"{self.url}/storage/v1/object/{self.bucket_name}/{clean_key}"
        res = requests.delete(
            endpoint,
            headers={"Authorization": f"Bearer {self.key}", "apikey": self.key},
            timeout=10,
        )
        return res.status_code in (200, 204)

    def exists(self, key: str) -> bool:
        import requests

        clean_key = key.replace("\\", "/").lstrip("/")
        endpoint = f"{self.url}/storage/v1/object/public/{self.bucket_name}/{clean_key}"
        res = requests.head(endpoint, timeout=10)
        return res.status_code == 200


_provider_instance: StorageProvider | None = None


def get_storage_provider() -> StorageProvider:
    global _provider_instance
    if _provider_instance is None:
        if (
            settings.storage_backend.lower() == "supabase"
            or (settings.supabase_url and settings.supabase_service_role_key)
        ):
            _provider_instance = SupabaseStorageProvider()
        elif settings.storage_backend.lower() == "s3" and settings.s3_bucket_name:
            _provider_instance = S3StorageProvider()
        else:
            _provider_instance = LocalStorageProvider()
    return _provider_instance


def generate_storage_key(event_id: uuid.UUID, filename: str, is_thumbnail: bool = False) -> str:
    """Creates a unique, organized storage key for an event photo or thumbnail."""
    prefix = "thumb" if is_thumbnail else "photo"
    clean_name = Path(filename).name.replace(" ", "_")
    unique_id = uuid.uuid4().hex[:12]
    ext = ".webp" if is_thumbnail else Path(filename).suffix.lower()
    if not ext:
        ext = ".jpg"
    return f"events/{event_id}/{prefix}_{unique_id}{ext}"
