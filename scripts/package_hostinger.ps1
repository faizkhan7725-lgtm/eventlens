# EventLens - Automated Hostinger Node.js Package Creator
# This script bundles the Next.js standalone build with all static assets into a single deployable ZIP.

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$FrontendDir = Join-Path $ProjectRoot "frontend"
$StandaloneDir = Join-Path $FrontendDir ".next\standalone"
$DistDir = Join-Path $ProjectRoot "dist"
$ZipFile = Join-Path $DistDir "eventlens-hostinger.zip"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   EventLens Hostinger Standalone Packager" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Step 1: Run Next.js Build
Write-Host "[1/5] Building Next.js production standalone bundle..." -ForegroundColor Yellow
Set-Location $FrontendDir
cmd /c "npm run build"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed with exit code $LASTEXITCODE"
    exit 1
}

if (-not (Test-Path $StandaloneDir)) {
    Write-Error "Standalone directory was not found at $StandaloneDir"
    exit 1
}

# Step 2: Copy static assets (Required by Next.js standalone mode)
Write-Host "[2/5] Copying static assets (.next/static)..." -ForegroundColor Yellow
$StaticSrc = Join-Path $FrontendDir ".next\static"
$StaticDest = Join-Path $StandaloneDir ".next\static"
if (Test-Path $StaticSrc) {
    if (-not (Test-Path $StaticDest)) {
        New-Item -ItemType Directory -Path $StaticDest -Force | Out-Null
    }
    Copy-Item -Path "$StaticSrc\*" -Destination $StaticDest -Recurse -Force
}

Write-Host "[3/5] Copying public folder (images, icons, fonts)..." -ForegroundColor Yellow
$PublicSrc = Join-Path $FrontendDir "public"
$PublicDest = Join-Path $StandaloneDir "public"
if (Test-Path $PublicSrc) {
    Copy-Item -Path $PublicSrc -Destination $StandaloneDir -Recurse -Force
}

# Step 3: Create .env.production template in standalone
Write-Host "[4/5] Creating .env.production template..." -ForegroundColor Yellow
$EnvDest = Join-Path $StandaloneDir ".env.production"
if (-not (Test-Path $EnvDest)) {
    @"
# EventLens Hostinger Production Environment
PORT=3000
NODE_ENV=production
NEXT_PUBLIC_APP_NAME=EventLens
NEXT_PUBLIC_API_URL=https://your-backend-api.onrender.com
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
"@ | Set-Content -Path $EnvDest -Encoding UTF8
}

# Step 4: Create Deployable ZIP
Write-Host "[5/5] Creating deployable ZIP archive: dist/eventlens-hostinger.zip..." -ForegroundColor Yellow
if (-not (Test-Path $DistDir)) {
    New-Item -ItemType Directory -Path $DistDir -Force | Out-Null
}
if (Test-Path $ZipFile) {
    Remove-Item -Path $ZipFile -Force
}

Compress-Archive -Path "$StandaloneDir\*" -DestinationPath $ZipFile -Force

Write-Host ""
Write-Host " SUCCESS! Hostinger deployment bundle created!" -ForegroundColor Green
Write-Host " Package location: $ZipFile" -ForegroundColor Green
Write-Host "----------------------------------------------------------"
Write-Host "Next steps on Hostinger hPanel:" -ForegroundColor White
Write-Host "1. In File Manager, upload 'dist/eventlens-hostinger.zip' into public_html" -ForegroundColor White
Write-Host "2. Right-click and Extract in public_html" -ForegroundColor White
Write-Host "3. In Node.js Manager, set Application Startup File to 'server.js'" -ForegroundColor White
Write-Host "4. Start/Restart the application. DONE!" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
