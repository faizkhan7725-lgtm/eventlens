from fastapi import APIRouter

from app.config import settings

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "version": settings.app_version,
        "similarity_threshold": settings.similarity_threshold,
        "face_model": settings.face_model_name,
    }
