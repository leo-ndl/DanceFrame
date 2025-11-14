#!/bin/bash

echo "📥 Downloading TensorFlow Lite MoveNet models..."

# Create directories
mkdir -p src/assets/models
mkdir -p android/app/src/main/assets/models
mkdir -p ios/DanceFrame/models

cd src/assets/models

# Download MoveNet Lightning (faster - 192x192)
echo "Downloading MoveNet Lightning..."
curl -L "https://tfhub.dev/google/lite-model/movenet/singlepose/lightning/tflite/int8/4?lite-format=tflite" \
  -o movenet_lightning.tflite

# Download MoveNet Thunder (accurate - 256x256)
echo "Downloading MoveNet Thunder..."
curl -L "https://tfhub.dev/google/lite-model/movenet/singlepose/thunder/tflite/int8/4?lite-format=tflite" \
  -o movenet_thunder.tflite

# Copy to Android
echo "Copying to Android..."
cp movenet_lightning.tflite ../../../android/app/src/main/assets/models/
cp movenet_thunder.tflite ../../../android/app/src/main/assets/models/

# Copy to iOS
echo "Copying to iOS..."
cp movenet_lightning.tflite ../../../ios/DanceFrame/models/
cp movenet_thunder.tflite ../../../ios/DanceFrame/models/

cd ../../..

echo "✅ Models downloaded successfully!"
echo ""
echo "Models location:"
echo "  - src/assets/models/"
echo "  - android/app/src/main/assets/models/"
echo "  - ios/DanceFrame/models/"
