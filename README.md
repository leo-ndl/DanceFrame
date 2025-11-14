# DanceFrame - AI Dance Coach

An AI-powered dance coaching app that helps you master popping dance moves with real-time pose detection and feedback using TensorFlow Lite.

## 🎯 Features

- 🤖 **On-Device AI** - TensorFlow Lite MoveNet for pose detection
- 📹 **Real-time Tracking** - Camera-based movement analysis
- 📊 **Performance Metrics** - Detailed scoring and feedback
- 🎵 **Beat Synchronization** - Timing analysis for dance moves
- 📈 **Progress Tracking** - Track improvement over time
- 🔒 **100% Offline** - All AI processing happens on your device

## 🛠 Tech Stack

- **Framework**: React Native 0.73+ with TypeScript
- **AI/ML**: TensorFlow Lite (react-native-fast-tflite)
- **Navigation**: React Navigation 6
- **State Management**: Zustand with MMKV
- **Camera**: React Native Vision Camera
- **Animations**: Reanimated 3

## 🏗 Architecture

Feature-based clean architecture with:
- Repository pattern for data layer
- Custom hooks for business logic
- Type-safe TypeScript throughout
- Offline-first design
- Backend-ready structure

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- React Native development environment
- iOS: Xcode 14+, CocoaPods
- Android: Android Studio, JDK 11+

### Installation

```bash
# Run setup script
chmod +x setup.sh
./setup.sh

# Download AI models
./scripts/download_models.sh

# Install iOS dependencies
cd ios && pod install && cd ..
```

### Running

```bash
# Start Metro
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios
```

## 📱 Project Structure

```
src/
├── app/              # Navigation & app entry
├── features/         # Feature modules
│   ├── dashboard/    # Home screen
│   ├── moves/        # Moves library
│   ├── practice/     # AI practice mode ⭐
│   └── progress/     # Analytics
├── shared/           # Shared components & hooks
├── core/             # Infrastructure
│   ├── ai/          # TensorFlow Lite engine ⭐
│   ├── data/        # Repositories
│   ├── storage/     # MMKV storage
│   └── state/       # Zustand store
├── config/          # Configuration & theme
└── assets/          # Images, videos, models
```

## 🤖 AI Implementation

DanceFrame uses **TensorFlow Lite MoveNet** for pose detection:

- **Lightning Model**: Fast, 192x192 input (recommended for real-time)
- **Thunder Model**: Accurate, 256x256 input (better quality)

The AI pipeline:
1. Camera captures frames (30fps)
2. Frame preprocessing (resize, normalize)
3. TensorFlow Lite inference (10fps)
4. Pose extraction (17 keypoints)
5. Movement comparison & scoring
6. Real-time feedback generation

## 📖 Documentation

- [Architecture Guide](docs/ARCHITECTURE.md)
- [API Migration Guide](docs/API_MIGRATION.md)
- [TensorFlow Lite Setup](docs/TENSORFLOW_SETUP.md)

## 🎓 For ARM AI Developer Challenge 2025

This project is built for the ARM AI Developer Challenge, showcasing:
- ✅ On-device AI processing optimized for ARM architecture
- ✅ Real-time pose detection and analysis
- ✅ Efficient mobile-first implementation
- ✅ Production-ready code structure

## 📝 License

MIT

## 🙏 Acknowledgments

- ARM AI Developer Challenge 2025
- TensorFlow Lite team
- React Native community
