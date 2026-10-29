# Project Technical Audit: SmartGallery to NovusGrid Event Photos

**Date:** October 2026  
**Auditor:** Principal Full-Stack & AI Systems Architect  
**Product Target:** NovusGrid Event Photos (Commercial Multi-Tenant SaaS)  
**Upstream Repository:** `https://github.com/sayan365/smartgallery.git` (Commit baseline: `main`)

---

## 1. Executive Summary

The upstream `smartgallery` repository is a compact, open-source proof-of-concept demonstrating AI face discovery over photos stored in Google Drive. It connects Next.js 16 (App Router) on the frontend with FastAPI, SQLAlchemy, Alembic, Celery, and InsightFace on the backend.

While the core concept—using face embeddings stored in `pgvector` to match guest selfies against event images—is sound, the existing codebase possesses several structural and commercial limitations that must be addressed to transform it into a high-performance, secure, multi-tenant commercial SaaS product under the **NovusGrid** brand.

---

## 2. Architecture & Technology Stack Audit

### 2.1 Backend Architecture
- **Framework:** FastAPI `0.141.1`, Starlette `1.6.0`, Uvicorn `0.34.0`, Python 3.11+.
- **ORM & Migrations:** SQLAlchemy `2.1.6`, Alembic `1.14.0`, `psycopg-binary` `3.3.6`.
- **Vector Search:** `pgvector` `0.3.6` (storing 512-dimensional float vectors with cosine distance indexing).
- **Background Workers:** Celery `5.4.0` with Redis `5.2.1` broker & backend. Configured with `solo` pool on Windows to avoid Windows fork/spawn issues.
- **AI / Computer Vision:**
  - `insightface` `1.0.1` (`FaceAnalysis`, default model `buffalo_l`).
  - `onnxruntime` `1.26.0` (CPU Execution Provider).
  - `opencv-python-headless` `4.13.0.92`, `Pillow` `12.3.0`, `numpy` `2.4.6`.

### 2.2 Frontend Architecture
- **Framework:** Next.js `16.3.0` (Turbopack, App Router), React `18.3.1`, React DOM `18.3.1`.
- **Styling:** Tailwind CSS `3.4.1`, PostCSS `8.5.26`.
- **Auth & Storage SDK:** `@supabase/ssr` `0.10.3`, `@supabase/supabase-js` `2.107.0`.
- **Utilities:** `qrcode` `1.5.4` (for in-browser QR generation and download poster export).
- **TypeScript:** Strict mode enabled (`tsconfig.json` target `es2017`).

---

## 3. Database Schema & Migration Review

The current schema consists of 5 tables managed through Alembic (`001_initial_schema.py` through `004_add_search_consent.py`):

1. **`photographers`**:
   - `id` (UUID, PK), `supabase_user_id` (UUID, nullable, unique), `name` (str), `email` (str, unique), `google_oauth_token` (Text, encrypted AES), timestamps.
2. **`events`**:
   - `id` (UUID, PK), `photographer_id` (FK -> `photographers.id`), `name` (str), `slug` (str, partial unique index for active status), `drive_folder_id` (str), `status` (str: `active`, `archived`), timestamps.
3. **`photos`**:
   - `id` (UUID, PK), `event_id` (FK -> `events.id`), `drive_file_id` (str, unique), `drive_url` (Text), `thumbnail_url` (Text), `filename` (str), `processed_at` (timestamp), `processing_status` (str: `pending`, `queued`, `processing`, `done`, `failed`), `created_at`.
4. **`face_embeddings`**:
   - `id` (UUID, PK), `photo_id` (FK -> `photos.id`), `embedding` (`Vector(512)`), `face_box` (JSONB: bounding box `x1, y1, x2, y2`), `created_at`.
5. **`search_sessions`**:
   - `id` (UUID, PK), `event_id` (FK -> `events.id`), `guest_name` (str), `guest_phone` (str), `guest_email` (str), `consented_at` (timestamp), `match_count` (int), `searched_at` (timestamp).

### Limitations in Existing Schema:
- **No Multi-Tenancy / Organization Entity:** Photographers exist only as individual user accounts. There is no concept of an organization, studio, team members, or roles (Owner, Admin, Photographer, Assistant).
- **Tight Google Drive Coupling in DDL:** `events.drive_folder_id` and `photos.drive_file_id` are non-nullable and strictly expect Google Drive identifiers. Direct uploads or alternative object storage (S3/Cloudflare R2/Supabase Storage) cannot be represented without schema evolution.
- **No Commercial Metering or Quotas:** No tables for subscription plans, stripe customers, credit balances, photo quotas, search limits, or audit logging.

---

## 4. Authentication & Authorization Review

- **Production Mode:** Supabase Auth validates JWTs sent in the `Authorization: Bearer <token>` header, either via Supabase Auth API (`/auth/v1/user`) or HS256 secret verification.
- **Local Development Mode:** Guarded local dev token (`LOCAL_DEV_AUTH=true`) requires `APP_ENVIRONMENT=development` and loopback IP (`127.0.0.1`/`localhost`), mapping to a fixed dummy developer UUID.
- **Guest Access:** Guests require zero authentication. They access `/event/[slug]`, provide name, phone, email, explicit consent, and a selfie. The backend creates an ephemeral search session and signs short-lived photo access tokens (`HMAC-SHA256` token bound to `event_id`, `photo_id`, and `session_id` valid for 15 minutes).

---

## 5. AI Pipeline & Face Recognition Audit

1. **Detection & Extraction:**
   - InsightFace `FaceAnalysis` initialized with `providers=["CPUExecutionProvider"]`.
   - Default detection size is 640x640 with fallback to 1024x1024 if no faces are found in high-resolution group shots.
2. **Embeddings:**
   - Generates 512-dimensional vector per face.
   - For guest selfies, prefers the largest face by bounding box area (`face_area`).
3. **Similarity Search:**
   - Cosine distance: `FaceEmbedding.embedding.cosine_distance(query_embedding) < similarity_threshold` (default `0.40`).
   - Results deduplicated by photo ID and limited to `max_search_results` (default `200`).

---

## 6. CRITICAL: Model Licensing & Commercial Use Audit

> [!IMPORTANT]
> **Pretrained Weights Legal Risk:**  
> While the `insightface` Python library wrapper is released under the **MIT License**, the popular default pretrained model packs (`buffalo_l`, `buffalo_m`, `antelopev2`) contain weights trained on datasets such as **Glint360k** and **MS1MV2**. The creators of these datasets and the DeepInsight project explicitly state that models trained on these datasets are **strictly restricted to non-commercial academic research**.
>
> **Commercial SaaS Requirements:**
> For NovusGrid Event Photos to be legally distributed as a commercial paid SaaS:
> 1. Commercial licensing agreement from DeepInsight / model authors, OR
> 2. Swapping the embedding backbone to a commercially cleared model architecture (e.g. MobileFaceNet or FaceNet trained on CASIA-WebFace or VGGFace2 under permissive commercial terms, or open-licensed ONNX models like ArcFace trained purely on permissive data), OR
> 3. Designing a pluggable model interface allowing the operator to supply their own commercial model endpoint or weights.

---

## 7. Storage & Operational Bottlenecks

1. **Google Drive Exclusivity:**
   - Upstream codebase requires Google Cloud OAuth credentials and the `drive.readonly` scope.
   - Photos are not stored locally; every thumbnail request proxies image bytes directly from Google Drive API on demand!
   - Under real event conditions (hundreds of guests opening galleries simultaneously), Google Drive API rate limits (10,000 queries per 100 seconds) will throttle and fail requests.
2. **Missing Direct Upload Engine:**
   - Professional event studios and schools often prefer direct batch uploads (drag and drop) into high-speed S3/Cloudflare R2/Supabase Storage rather than routing through personal Google Drive accounts.
   - Direct upload with pre-generated compressed thumbnails is essential for commercial reliability.

---

## 8. Windows Development & Local Execution Findings

1. **Docker Requirement in `setup-local.ps1`:**
   - The upstream script immediately errors out if Docker Desktop is not in PATH.
   - On Windows developer environments without Docker, a native or managed alternative (e.g. Supabase cloud pooler, Neon, or local Postgres) must be supported.
2. **Config Path Resolution:**
   - Pydantic Settings defaults to `env_file=(".env", ".env.local")` relative to the current working directory. Running pytest from repository root previously failed because `.env.local` was in `backend/`.
3. **Celery Worker on Windows:**
   - Celery `solo` pool is correctly specified in `backend/app/worker.py` for Windows compatibility.
4. **Python Version Compatibility:**
   - Python 3.11 (via `uv`) successfully installed all 91 wheels including `insightface`, `onnxruntime`, `opencv-python-headless`, and `psycopg-binary` without compiler errors.

---

## 9. Verification Baseline (Phase 1 Status)

| Check | Upstream State | NovusGrid Baseline Status |
|---|---|---|
| **Python Virtual Environment** | Missing | Created with Python 3.11.16 (`uv venv backend/.venv`) |
| **Backend Dependencies** | Uninstalled | Installed 91 packages via `uv pip` |
| **Frontend Dependencies** | Uninstalled | Installed 425 packages via `npm ci` |
| **Backend Unit Tests** | Failed collection without env | **6 of 6 PASSED** (`test_security.py`) |
| **Frontend Linting** | Untested | **PASSED** (`eslint .`) |
| **Frontend TypeScript** | Untested | **PASSED** (`tsc --noEmit`) |
| **Frontend Production Build** | Untested | **PASSED** (`next build` via Turbopack) |
| **FastAPI Health Endpoint** | Untested | **Verified HTTP 200** (`/api/health`) |
| **FastAPI Docs / OpenAPI** | Untested | **Verified HTTP 200** (`/openapi.json`) |
| **Next.js Dev Server** | Untested | **Verified HTTP 200** (Ready in <1s) |

