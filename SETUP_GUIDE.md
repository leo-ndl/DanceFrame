# DanceFrame Setup Guide

## Quick Start

### 1. Run the Setup Script

```bash
chmod +x setup.sh
./setup.sh
```

This creates:
- ✅ Complete directory structure
- ✅ All configuration files
- ✅ Theme system
- ✅ TensorFlow Lite integration
- ✅ State management setup
- ✅ Navigation structure
- ✅ Basic screens
- ✅ AI infrastructure

### 2. Download AI Models

```bash
./scripts/download_models.sh
```

Downloads MoveNet models from TensorFlow Hub.

### 3. Install iOS Dependencies

```bash
cd ios
pod install
cd ..
```

### 4. Run the App

```bash
# Android
npm run android

# iOS
npm run ios
```

## What's Included

### ✅ Complete Architecture
- Feature-based structure
- Repository pattern (backend-ready)
- TensorFlow Lite AI engine
- Type-safe TypeScript

### ✅ AI/ML Setup
- TensorFlow Lite integration
- MoveNet model management
- Frame processing pipeline
- Pose detection infrastructure

### ✅ UI Components
- Themed components
- Navigation (tabs + stack)
- Dashboard screen
- Progress screen

### ✅ Data Layer
- MMKV storage
- Zustand state management
- Moves repository
- Sample data

### ✅ Configuration
- Theme (colors, typography, spacing)
- Environment config
- AI constants
- App constants

## Next Steps

### Phase 1: Complete AI Integration (Week 1)

1. **Implement Pose Detection Hook**
   - File: `src/features/practice/hooks/usePoseDetection.ts`
   - Connect to ModelManager
   - Handle frame processing

2. **Build Camera Component**
   - File: `src/features/practice/components/camera/CameraView.tsx`
   - Integrate Vision Camera
   - Add frame processor

3. **Create Skeleton Overlay**
   - File: `src/features/practice/components/overlay/SkeletonOverlay.tsx`
   - Draw keypoints
   - Connect lines

### Phase 2: Practice Mode (Week 2)

1. **Practice Screen**
   - Camera view
   - Real-time overlay
   - Controls

2. **Movement Analysis**
   - File: `src/features/practice/services/movementComparison.ts`
   - Compare poses
   - Calculate scores

3. **Feedback System**
   - File: `src/features/practice/services/feedbackGenerator.ts`
   - Generate tips
   - Display real-time

### Phase 3: Polish (Week 3-4)

1. Results screen
2. Progress tracking
3. Animations
4. Testing

## Project Structure

```
DanceFrame/
├── src/
│   ├── app/                    # Navigation
│   ├── features/
│   │   ├── dashboard/          # Home
│   │   ├── moves/              # Library
│   │   ├── practice/           # AI Mode ⭐
│   │   └── progress/           # Stats
│   ├── shared/                 # Components
│   ├── core/
│   │   ├── ai/                # TFLite ⭐
│   │   ├── data/              # Repos
│   │   ├── storage/           # MMKV
│   │   └── state/             # Zustand
│   ├── config/                # Theme
│   └── assets/
│       └── models/            # TFLite models
├── android/
├── ios/
└── scripts/
```

## Commands

```bash
# Development
npm start                 # Start Metro
npm run android          # Run Android
npm run ios              # Run iOS

# Maintenance
npm run type-check       # TypeScript check
npm run lint             # ESLint
./scripts/clean_all.sh   # Clean everything

# Models
./scripts/download_models.sh  # Get AI models
```

## Troubleshooting

### Build Errors

```bash
# Clean everything
./scripts/clean_all.sh
npm install
cd ios && pod install && cd ..
```

### Model Not Found

```bash
./scripts/download_models.sh

# iOS: Ensure models are added to Xcode target
# Android: Check android/app/src/main/assets/models/
```

### Metro Issues

```bash
npm start -- --reset-cache
```

## Development Tips

1. **Start with Lightning model** - Faster for development
2. **Test on real device** - Simulator/emulator too slow for AI
3. **Good lighting** - Important for pose detection
4. **Frame in view** - Keep full body visible

## Resources

- [TensorFlow Lite Docs](https://www.tensorflow.org/lite)
- [React Native Vision Camera](https://react-native-vision-camera.com/)
- [MoveNet Model](https://tfhub.dev/google/movenet)

## 🚀 You're Ready!

Your DanceFrame boilerplate is complete with TensorFlow Lite integration. Focus on implementing the practice mode with camera and pose detection.

Good luck with the ARM AI Developer Challenge 2025! 🎉
