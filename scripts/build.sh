#!/bin/bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$PROJECT_ROOT/dist/Watermarks Cleaner.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/engine"
cp "$PROJECT_ROOT/app/bridge.py" "$APP/Contents/Resources/bridge.py"
cp -R "$PROJECT_ROOT/upstream/service/scripts" "$APP/Contents/Resources/engine/"
cp "$PROJECT_ROOT/upstream/LICENSE" "$APP/Contents/Resources/UPSTREAM-LICENSE"
cp "$PROJECT_ROOT/app/Info.plist" "$APP/Contents/Info.plist"
cp "$PROJECT_ROOT/app/Assets/AppIcon.png" "$APP/Contents/Resources/AppIcon.png"
ICONSET="$PROJECT_ROOT/.build/AppIcon.iconset"
mkdir -p "$ICONSET"
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$PROJECT_ROOT/app/Assets/AppIcon.png" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -z "$double" "$double" "$PROJECT_ROOT/app/Assets/AppIcon.png" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns"
xcrun swiftc -parse-as-library -O -swift-version 5 \
  -module-cache-path "$PROJECT_ROOT/.build/module-cache" \
  -framework SwiftUI -framework AppKit -framework UniformTypeIdentifiers \
  "$PROJECT_ROOT/app/WatermarksApp.swift" -o "$APP/Contents/MacOS/WatermarksCleaner"
codesign --force --sign - "$APP"
printf 'Built: %s\n' "$APP"
