#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "BuddyPing release build"
echo "========================"

# Check required files
missing=0
for f in ".env" "android/app/google-services.json" "android/app/buddyping-release.jks"; do
  if [ ! -f "$f" ]; then
    echo -e "${RED}MISSING:${NC} $f"
    missing=1
  fi
done

if [ "$missing" -eq 1 ]; then
  echo ""
  echo "Copy the missing files from Windows (see ubuntu.md Part 2) then retry."
  exit 1
fi

# Check keystore passwords are not still placeholders
if grep -q "your_keystore_password\|your_key_password" android/gradle.properties 2>/dev/null; then
  echo -e "${RED}ERROR:${NC} android/gradle.properties still has placeholder passwords."
  echo "Update BUDDYPING_RELEASE_STORE_PASSWORD and BUDDYPING_RELEASE_KEY_PASSWORD then retry."
  exit 1
fi

echo -e "${GREEN}All required files present.${NC}"
echo ""

# Install dependencies if node_modules is missing or stale
if [ ! -d "node_modules" ]; then
  echo "Running npm install..."
  npm install
else
  echo "node_modules present, skipping npm install. Run 'npm install' manually if packages changed."
fi

echo ""
echo "Building release APK..."
cd android
./gradlew assembleRelease
cd ..

APK="android/app/build/outputs/apk/release/app-release.apk"

if [ -f "$APK" ]; then
  SIZE=$(du -sh "$APK" | cut -f1)
  echo ""
  echo -e "${GREEN}Build successful!${NC}"
  echo "APK:  $(realpath "$APK")"
  echo "Size: $SIZE"
else
  echo -e "${RED}Build finished but APK not found at expected path.${NC}"
  exit 1
fi
