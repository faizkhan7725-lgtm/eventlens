import re
import urllib.parse
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


def _sanitize_db_url(url: str) -> str:
    """Sanitizes unencoded characters (like '@' in password) and removes conflicting pooler query params."""
    if not url:
        return url
    m = re.match(r"^(?P<scheme>[^:]+://)(?P<user>[^:]+):(?P<rest>.+)$", url)
    if not m:
        return url
    scheme = m.group("scheme")
    user = m.group("user")
    rest = m.group("rest")
    if "@" in rest:
        last_at = rest.rfind("@")
        password = rest[:last_at]
        host_and_path = rest[last_at + 1 :]
        # Strip ?prepare_threshold=0 which causes type mismatch in modern psycopg
        host_and_path = re.sub(r"\?prepare_threshold=[^&]*", "", host_and_path).rstrip("?")
        encoded_password = urllib.parse.quote_plus(urllib.parse.unquote_plus(password))
        return f"{scheme}{user}:{encoded_password}@{host_and_path}"
    return url


def _create_db_engine():
    raw_url = settings.database_url.strip() if settings.database_url else ""
    db_url = _sanitize_db_url(raw_url)
    if not db_url:
        # Fallback in-memory engine to allow module import, CLI inspection, and testing
        return create_engine("sqlite:///:memory:")

    if db_url.startswith("postgresql://") or db_url.startswith("postgresql+psycopg://"):
        target_url = (
            db_url.replace("postgresql://", "postgresql+psycopg://", 1)
            if db_url.startswith("postgresql://")
            else db_url
        )
        # Supabase poolers (PgBouncer/Supavisor) can choke on psycopg prepared statements across pooled sessions.
        # Disable auto-prepared statements so repeated writes don't fail with
        # "DuplicatePreparedStatement" errors.
        return create_engine(
            target_url,
            pool_pre_ping=True,
            connect_args={"prepare_threshold": None},
        )
    return create_engine(db_url, pool_pre_ping=True)


engine = _create_db_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
