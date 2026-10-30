import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routers import auth, events, health, public


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Non-blocking background warmup so Render startup port probe succeeds instantly (sub-second)
    async def _warmup():
        try:
            await asyncio.sleep(2)
            from app.services.faces import face_analysis

            await asyncio.to_thread(face_analysis)
            print("[lifespan] Face analysis models pre-warmed successfully.")
        except Exception as exc:
            print(f"[lifespan] Warning: could not pre-warm face models: {exc}")

    warmup_task = asyncio.create_task(_warmup())
    yield
    warmup_task.cancel()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
    openapi_url="/openapi.json" if settings.debug or settings.expose_api_docs else None,
    docs_url="/docs" if settings.debug or settings.expose_api_docs else None,
    redoc_url="/redoc" if settings.debug or settings.expose_api_docs else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(events.router, prefix="/api")
app.include_router(public.router, prefix="/api")


def _apply_security_headers(response, request=None):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(self), microphone=(), geolocation=()"
    if request:
        origin = request.headers.get("origin")
        if origin and (origin in settings.allowed_cors_origins or "*" in settings.allowed_cors_origins):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
    return response


@app.middleware("http")
async def security_headers(request, call_next):
    if request.method == "POST" and request.url.path.endswith("/search"):
        content_length = request.headers.get("content-length")
        max_request_bytes = settings.max_selfie_bytes + 256 * 1024
        if content_length:
            try:
                if int(content_length) > max_request_bytes:
                    return _apply_security_headers(
                        JSONResponse(status_code=413, content={"detail": "Request body is too large"}),
                        request=request,
                    )
            except ValueError:
                return _apply_security_headers(
                    JSONResponse(status_code=400, content={"detail": "Invalid Content-Length header"}),
                    request=request,
                )

    return _apply_security_headers(await call_next(request), request=request)
