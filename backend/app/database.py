from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


def _create_db_engine():
    db_url = settings.database_url.strip() if settings.database_url else ""
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
