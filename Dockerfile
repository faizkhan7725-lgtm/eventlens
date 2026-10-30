FROM python:3.11-slim-bookworm

# Install system dependencies required by OpenCV and InsightFace
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    libgomp1 \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install --no-cache-dir --upgrade pip

# Install Python requirements
COPY backend/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code, lightweight models, and alembic migrations
COPY backend/alembic.ini alembic.ini
COPY backend/alembic ./alembic
COPY backend/models ./models
COPY backend/app ./app

# Create upload folder for local storage
RUN mkdir -p /app/uploads

EXPOSE 8000

# Run migrations safely and launch FastAPI
CMD ["sh", "-c", "alembic upgrade head || true; exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
