# TensorFlow Lite Setup Guide

## Overview

DanceFrame uses TensorFlow Lite with MoveNet models for on-device pose detection.

## Models

### MoveNet Lightning
- Input: 192x192
- Speed: Fast (~30ms per inference on modern devices)
- Accuracy: Good
- **Recommended for real-time practice mode**

### MoveNet Thunder
- Input: 256x256
- Speed: Slower (~50ms per inference)
- Accuracy: Excellent
- **Recommended for detailed analysis**

## Installation

The setup script automatically installs:

```json
{
  "react-native-fast-tflite": "^1.1.0",
  "@tensorflow/tfjs": "^4.15.0",
  "@tensorflow/tfjs-react-native": "^0.8.0"
}
```

## Downloading Models

```bash
./scripts/download_models.sh
```

This downloads both MoveNet models and places them in:
- `android/app/src/main/assets/models/`
- `ios/DanceFrame/models/`

## Model Loading

```typescript
import { modelManager } from '@/core/ai/models/ModelManager';

// Initialize on app start
await modelManager.initialize('lightning');

// Get model for inference
const model = modelManager.getModel('lightning');
```

## Inference Pipeline

### 1. Frame Preprocessing

```typescript
import { FrameProcessor } from '@/core/ai/processors/FrameProcessor';

const input = FrameProcessor.preprocessFrame(
  frameData,
  width,
  height,
  192 // target size
);
```

### 2. Run Inference

```typescript
const model = modelManager.getModel('lightning');
const output = await model.run(input);
```

### 3. Parse Output

```typescript
import { PoseProcessor } from '@/core/ai/processors/PoseProcessor';

const pose = PoseProcessor.processPoseOutput(output);
```

## Output Format

MoveNet returns 17 keypoints:

```typescript
{
  keypoints: [
    { name: 'nose', x: 0.5, y: 0.3, confidence: 0.95 },
    { name: 'leftShoulder', x: 0.4, y: 0.5, confidence: 0.92 },
    // ... 15 more keypoints
  ],
  timestamp: 1234567890,
  confidence: 0.89
}
```

## Keypoints (17 total)

1. nose
2. leftEye, rightEye
3. leftEar, rightEar
4. leftShoulder, rightShoulder
5. leftElbow, rightElbow
6. leftWrist, rightWrist
7. leftHip, rightHip
8. leftKnee, rightKnee
9. leftAnkle, rightAnkle

## Performance Optimization

### Frame Throttling
```typescript
// Process every 3rd frame (30fps → 10fps)
if (frameCount % 3 === 0) {
  await detectPose(frame);
}
```

### Model Warm-up
```typescript
// Run dummy inference on init
await modelManager.initialize('lightning');
// Model is now ready for fast inference
```

### Memory Management
```typescript
// Dispose models when done
useEffect(() => {
  return () => {
    modelManager.dispose();
  };
}, []);
```

## Platform-Specific Notes

### Android
- Models must be in `android/app/src/main/assets/models/`
- Access via filename: `movenet_lightning.tflite`

### iOS
- Models must be in `ios/DanceFrame/models/`
- Add to Xcode project
- Access via path: `models/movenet_lightning.tflite`

## Troubleshooting

### Model Not Found
```bash
# Re-download models
./scripts/download_models.sh

# For iOS, ensure models are added to Xcode target
```

### Slow Inference
- Use Lightning model instead of Thunder
- Increase frame skip (process every 4th or 5th frame)
- Check device temperature (throttling)

### Low Accuracy
- Ensure good lighting
- Keep full body in frame
- Use Thunder model for better accuracy
- Increase minimum confidence threshold

## References

- [TensorFlow Lite Docs](https://www.tensorflow.org/lite)
- [MoveNet Model](https://tfhub.dev/google/movenet)
- [react-native-fast-tflite](https://github.com/mrousavy/react-native-fast-tflite)
