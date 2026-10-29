from pathlib import Path
from urllib.parse import urlparse
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_backend_dir = Path(__file__).resolve().parent.parent
_repo_dir = _backend_dir.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(
            str(_backend_dir / ".env"),
            str(_backend_dir / ".env.local"),
            str(_repo_dir / ".env"),
            str(_repo_dir / ".env.local"),
            ".env",
            ".env.local",
        ),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "NovusGrid Event Photos"
    app_version: str = "0.1.0"
    app_environment: str = "production"
    debug: bool = False
    expose_api_docs: bool = False
    secret_key: str = ""
    local_dev_auth: bool = False
    local_dev_auth_token: str = ""
    local_dev_user_email: str = "developer@localhost"

    database_url: str = ""
    redis_url: str = ""
    celery_broker_url: str = ""
    celery_result_backend: str = ""

    supabase_url: str = ""
    supabase_jwt_secret: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_audience: str = "authenticated"
    google_client_id: str = ""
    google_client_secret: str = ""

    similarity_threshold: float = 0.45
    max_search_results: int = 200
    face_model_name: str = "buffalo_s"
    face_detection_size: int = 640
    face_detection_fallback_size: int = 1024
    auto_sync_interval_minutes: int = 30

    max_selfie_bytes: int = 8 * 1024 * 1024
    max_image_pixels: int = 25_000_000
    public_searches_per_minute: int = 10
    trusted_proxy_hops: int = 0
    photo_access_token_minutes: int = 15
    search_session_retention_days: int = 30

    frontend_url: str = "http://localhost:3000"
    cors_origins: str = ""

    @property
    def allowed_cors_origins(self) -> list[str]:
        origins = set()
        if self.frontend_url:
            origins.add(self.frontend_url.strip().rstrip("/"))
        if self.cors_origins:
            for item in self.cors_origins.split(","):
                cleaned = item.strip().rstrip("/")
                if cleaned:
                    origins.add(cleaned)
        return list(origins) if origins else ["http://localhost:3000"]

    # AI & Gemini Settings
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"

    # Storage settings
    storage_backend: str = "local"
    storage_local_dir: str = "uploads"
    max_upload_bytes: int = 25 * 1024 * 1024
    s3_endpoint_url: str = ""
    s3_bucket_name: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_region_name: str = "auto"

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, value: object) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on", "debug", "development", "dev"}:
                return True
            if normalized in {"0", "false", "no", "off", "release", "production", "prod"}:
                return False
        return bool(value)

    @model_validator(mode="after")
    def validate_security_settings(self):
        normalized_secret = self.secret_key.lower()
        placeholder_markers = ("change-me", "replace-with", "your-secret", "example")
        if len(self.secret_key) < 32 or any(
            marker in normalized_secret for marker in placeholder_markers
        ):
            raise ValueError("SECRET_KEY must be a random value of at least 32 characters")
        if not self.supabase_jwt_audience.strip():
            raise ValueError("SUPABASE_JWT_AUDIENCE must not be empty")
        if self.max_selfie_bytes < 1024:
            raise ValueError("MAX_SELFIE_BYTES must be at least 1024")
        if self.public_searches_per_minute < 1:
            raise ValueError("PUBLIC_SEARCHES_PER_MINUTE must be at least 1")
        if self.search_session_retention_days < 1:
            raise ValueError("SEARCH_SESSION_RETENTION_DAYS must be at least 1")
        if self.local_dev_auth:
            if self.app_environment.lower() != "development":
                raise ValueError("LOCAL_DEV_AUTH is only allowed in development")
            if len(self.local_dev_auth_token) < 32:
                raise ValueError("LOCAL_DEV_AUTH_TOKEN must be at least 32 characters")
            local_hosts = {"127.0.0.1", "localhost", "::1"}
            if urlparse(self.database_url).hostname not in local_hosts:
                raise ValueError("LOCAL_DEV_AUTH requires a loopback database")
            if urlparse(self.frontend_url).hostname not in local_hosts:
                raise ValueError("LOCAL_DEV_AUTH requires a loopback frontend URL")
        return self


settings = Settings()
