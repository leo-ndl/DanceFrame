# DanceFrame Architecture

## Overview

DanceFrame uses a feature-based clean architecture with TensorFlow Lite for on-device AI.

## Core Principles

1. **Feature-based structure** - Each feature is self-contained
2. **Repository pattern** - Abstract data layer for backend flexibility
3. **Hooks for logic** - Business logic separated from UI
4. **Type-safe** - Full TypeScript coverage
5. **Offline-first** - All AI runs on-device with TFLite

## Directory Structure

```
src/
├── app/              # App entry & navigation
├── features/         # Feature modules (domain-driven)
│   ├── dashboard/    # Home screen with moves library
│   ├── moves/        # Move details and data
│   ├── practice/     # AI practice mode (CORE)
│   └── progress/     # Analytics and tracking
├── shared/           # Shared components & hooks
├── core/             # Core infrastructure
│   ├── ai/          # TensorFlow Lite AI engine
│   ├── data/        # Repositories & data sources
│   ├── storage/     # MMKV persistent storage
│   ├── api/         # Future: Backend API
│   └── state/       # Zustand state management
├── config/          # Configuration & constants
└── assets/          # Static assets & models
```

## Data Flow

```
UI Layer (Screens/Components)
    ↓ uses hooks
Business Logic (Custom Hooks)
    ↓ calls services/repositories
Data Layer (Repositories)
    ↓ uses data sources
Storage (Local/Remote Data Sources)
```

## AI/ML Pipeline

```
Camera (30fps)
    ↓
Frame Processor (every 3rd frame → 10fps)
    ↓ resize & normalize
TensorFlow Lite Model (MoveNet)
    ↓ inference
Pose Processor
    ↓ parse keypoints
Movement Comparator
    ↓ compare with reference
Feedback Generator
    ↓ real-time feedback
UI Update
```

## State Management

- **Zustand** for global app state
- **MMKV** for persistent storage (10x faster than AsyncStorage)
- **Component state** for local UI state

## Key Components

### AI Engine
- `ModelManager`: Singleton for TFLite model lifecycle
- `FrameProcessor`: Preprocesses camera frames
- `PoseProcessor`: Converts model output to Pose objects
- `MovementComparator`: Compares user pose with reference

### Data Layer
- `MovesRepository`: Manages move data
- `LocalDataSource`: Local storage implementation
- `RemoteDataSource`: Future API integration

### Practice Flow
1. User selects a move
2. Camera initializes
3. Model loads and warms up
4. Frame processing starts (10fps)
5. Real-time feedback displayed
6. Session results saved

## Performance Optimizations

- **Frame throttling**: Process every 3rd frame
- **Model warm-up**: Pre-run dummy inference
- **MMKV storage**: Ultra-fast key-value storage
- **Reanimated**: 60fps animations
- **Proper cleanup**: Dispose models on unmount

## Backend Migration

The repository pattern enables easy backend integration:

```typescript
// Current: Local only
new MovesRepository(new LocalDataSource());

// Future: Local + Remote with cache
new MovesRepository(
  new LocalDataSource(),
  new RemoteDataSource()
);
```

No UI changes needed - the repository handles sync automatically.

## Testing Strategy

```
__tests__/
├── unit/              # Pure functions, utilities
│   ├── ai/           # AI processors
│   ├── hooks/        # Custom hooks
│   └── utils/        # Helper functions
├── integration/       # Feature flows
└── e2e/              # Full app scenarios
```

## Build & Deploy

- Android: `./gradlew assembleRelease`
- iOS: Archive in Xcode
- Models bundled in app binary
- No server required for MVP
