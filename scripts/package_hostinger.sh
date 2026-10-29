#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
STANDALONE_DIR="$FRONTEND_DIR/.next/standalone"
DIST_DIR="$PROJECT_ROOT/dist"
ZIP_FILE="$DIST_DIR/eventlens-hostinger.zip"

echo "=== Building EventLens Hostinger Standalone Bundle ==="

cd "$FRONTEND_DIR"
npm run build

echo "=== Copying static files to standalone ==="
mkdir -p "$STANDALONE_DIR/.next/static"
cp -r "$FRONTEND_DIR/.next/static/"* "$STANDALONE_DIR/.next/static/"

if [ -d "$FRONTEND_DIR/public" ]; then
  cp -r "$FRONTEND_DIR/public" "$STANDALONE_DIR/"
fi

mkdir -p "$DIST_DIR"
rm -f "$ZIP_FILE"

cd "$STANDALONE_DIR"
zip -r "$ZIP_FILE" .

echo "=== SUCCESS: Bundle created at $ZIP_FILE ==="
