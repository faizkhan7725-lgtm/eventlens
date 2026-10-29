<#
.SYNOPSIS
    NovusGrid Event Photos - Windows Local Development Setup Script
#>

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = (Resolve-Path (Join-Path $scriptDir "..")).Path
$backendDir = Join-Path $projectRoot "backend"
$frontendDir = Join-Path $projectRoot "frontend"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   NovusGrid Event Photos - Windows Environment Setup     " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Project Root: $projectRoot"

# 1. Verify Prerequisites
Write-Host "`n[1/6] Checking system tools..." -ForegroundColor Yellow
$hasUv = [bool](Get-Command uv -ErrorAction SilentlyContinue)
$hasPython = [bool](Get-Command python -ErrorAction SilentlyContinue)
$hasNode = [bool](Get-Command node -ErrorAction SilentlyContinue)
$hasNpm = [bool](Get-Command npm -ErrorAction SilentlyContinue)
$hasDocker = [bool](Get-Command docker -ErrorAction SilentlyContinue)

if (-not $hasNode -or -not $hasNpm) {
    throw "Node.js (>=20.9.0) and npm are required. Please install Node.js."
}
$nodeVer = & node --version
Write-Host "  [OK] Node.js and npm detected: $nodeVer" -ForegroundColor Green

# 2. Setup Python Virtual Environment
Write-Host "`n[2/6] Setting up Python virtual environment..." -ForegroundColor Yellow
$venvDir = Join-Path $backendDir ".venv"
$venvPython = Join-Path $venvDir "Scripts\python.exe"

if (-not (Test-Path -LiteralPath $venvPython)) {
    if ($hasUv) {
        Write-Host "  Creating virtual environment with uv (Python 3.11)..."
        uv venv $venvDir --python 3.11
    } elseif ($hasPython) {
        Write-Host "  Creating virtual environment with python -m venv..."
        & python -m venv $venvDir
    } else {
        throw "Neither uv nor Python found in PATH. Please install Python 3.11+."
    }
}
Write-Host "  [OK] Python virtual environment ready: $venvPython" -ForegroundColor Green

# 3. Install Dependencies
Write-Host "`n[3/6] Installing backend dependencies..." -ForegroundColor Yellow
if ($hasUv) {
    & uv pip install --python $venvPython -r (Join-Path $backendDir "requirements-dev.txt")
} else {
    & $venvPython -m pip install -r (Join-Path $backendDir "requirements-dev.txt")
}
Write-Host "  [OK] Backend dependencies installed." -ForegroundColor Green

Write-Host "`n[4/6] Installing frontend dependencies..." -ForegroundColor Yellow
Push-Location $frontendDir
try {
    & npm ci
} finally {
    Pop-Location
}
Write-Host "  [OK] Frontend npm packages installed." -ForegroundColor Green

# 4. Generate Development Environment Secrets
Write-Host "`n[5/6] Verifying local development configuration..." -ForegroundColor Yellow
$backendLocalEnv = Join-Path $backendDir ".env.local"
$frontendLocalEnv = Join-Path $frontendDir ".env.development.local"

if (-not (Test-Path -LiteralPath $backendLocalEnv)) {
    $secretKey = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
    $devAuthToken = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")

    $backendLines = @(
        "# NovusGrid Event Photos - Local Development Settings",
        "APP_NAME=NovusGrid Event Photos",
        "APP_VERSION=0.1.0",
        "APP_ENVIRONMENT=development",
        "DEBUG=true",
        "EXPOSE_API_DOCS=true",
        "SECRET_KEY=$secretKey",
        "FRONTEND_URL=http://localhost:3000",
        "LOCAL_DEV_AUTH=true",
        "LOCAL_DEV_AUTH_TOKEN=$devAuthToken",
        "LOCAL_DEV_USER_EMAIL=developer@localhost",
        "DATABASE_URL=postgresql://smartgallery:smartgallery_local_only@127.0.0.1:5432/smartgallery",
        "REDIS_URL=redis://127.0.0.1:6379/0",
        "CELERY_BROKER_URL=redis://127.0.0.1:6379/0",
        "CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/0",
        "AUTO_SYNC_INTERVAL_MINUTES=30",
        "SEARCH_SESSION_RETENTION_DAYS=30",
        "MAX_SELFIE_BYTES=8388608",
        "MAX_IMAGE_PIXELS=25000000",
        "PUBLIC_SEARCHES_PER_MINUTE=10",
        "TRUSTED_PROXY_HOPS=0",
        "PHOTO_ACCESS_TOKEN_MINUTES=15",
        "SIMILARITY_THRESHOLD=0.4",
        "MAX_SEARCH_RESULTS=200",
        "FACE_MODEL_NAME=buffalo_l",
        "FACE_DETECTION_SIZE=640",
        "FACE_DETECTION_FALLBACK_SIZE=1024"
    )
    [IO.File]::WriteAllLines($backendLocalEnv, $backendLines, [Text.UTF8Encoding]::new($false))
    Write-Host "  [OK] Generated backend\.env.local" -ForegroundColor Green

    $frontendLines = @(
        "NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api",
        "NEXT_PUBLIC_LOCAL_DEV_AUTH=true",
        "NEXT_PUBLIC_LOCAL_DEV_AUTH_TOKEN=$devAuthToken"
    )
    [IO.File]::WriteAllLines($frontendLocalEnv, $frontendLines, [Text.UTF8Encoding]::new($false))
    Write-Host "  [OK] Generated frontend\.env.development.local" -ForegroundColor Green
} else {
    Write-Host "  [OK] backend\.env.local and frontend\.env.development.local already exist." -ForegroundColor Green
}

# 5. Database Status Check
Write-Host "`n[6/6] Checking database infrastructure..." -ForegroundColor Yellow
if ($hasDocker) {
    Write-Host "  Docker detected. You can launch local PostgreSQL/pgvector and Redis with:"
    Write-Host "    docker compose up -d database redis" -ForegroundColor Cyan
} else {
    Write-Host "  Note: Docker is not detected in PATH." -ForegroundColor Gray
    Write-Host "  You can point DATABASE_URL in backend\.env.local to any PostgreSQL + pgvector instance" -ForegroundColor Gray
    Write-Host "  (e.g. Supabase, Neon, or local Windows PostgreSQL)." -ForegroundColor Gray
}

# 6. Run Baseline Tests
Write-Host "`nRunning test verification..." -ForegroundColor Yellow
& $venvPython -m pytest (Join-Path $backendDir "tests") -q
if ($LASTEXITCODE -eq 0) {
    Write-Host "`n  [OK] All test checks passed!" -ForegroundColor Green
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "NovusGrid Event Photos is ready for local development!" -ForegroundColor Cyan
Write-Host "To start the application:"
Write-Host "  1. Start backend:  cd backend; .venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"
Write-Host "  2. Start frontend: cd frontend; npm run dev"
Write-Host "  3. Open browser:   http://localhost:3000"
Write-Host "==========================================================" -ForegroundColor Cyan
