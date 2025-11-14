#!/bin/bash

echo "🧹 Cleaning DanceFrame project..."

# Node modules
echo "Removing node_modules..."
rm -rf node_modules

# iOS
echo "Cleaning iOS..."
cd ios
rm -rf Pods
rm -rf build
rm -f Podfile.lock
cd ..

# Android
echo "Cleaning Android..."
cd android
./gradlew clean 2>/dev/null || echo "Gradle clean skipped"
cd ..
rm -rf android/.gradle

# Metro cache
echo "Cleaning Metro cache..."
rm -rf $TMPDIR/metro-* 2>/dev/null
rm -rf $TMPDIR/haste-map-* 2>/dev/null

# Watchman
echo "Clearing Watchman..."
watchman watch-del-all 2>/dev/null || echo "Watchman not available"

echo "✅ Clean complete!"
echo ""
echo "Next steps:"
echo "  1. npm install"
echo "  2. cd ios && pod install && cd .."
echo "  3. npm start -- --reset-cache"
