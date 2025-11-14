export const AI_CONSTANTS = {
  // MoveNet model configurations
  MODEL_INPUT_SIZE: 192, // 192x192 for Lightning, 256x256 for Thunder
  MODEL_THUNDER_SIZE: 256,
  FRAME_SKIP: 3, // Process every 3rd frame (30fps → 10fps)
  MIN_CONFIDENCE: 0.3,
  
  // MoveNet keypoint indices
  KEYPOINT_NAMES: [
    'nose',
    'leftEye',
    'rightEye',
    'leftEar',
    'rightEar',
    'leftShoulder',
    'rightShoulder',
    'leftElbow',
    'rightElbow',
    'leftWrist',
    'rightWrist',
    'leftHip',
    'rightHip',
    'leftKnee',
    'rightKnee',
    'leftAnkle',
    'rightAnkle',
  ] as const,
  
  // Score thresholds
  SCORE_THRESHOLDS: {
    EXCELLENT: 90,
    GOOD: 75,
    FAIR: 60,
  },
  
  // Model types
  MODEL_TYPES: {
    LIGHTNING: 'lightning', // Faster, less accurate
    THUNDER: 'thunder', // Slower, more accurate
  },
  
  // TensorFlow Lite specific
  TFLITE: {
    NUM_KEYPOINTS: 17,
    NUM_CHANNELS: 3, // RGB
    OUTPUT_STRIDE: 32,
  },
};

export type KeypointName = typeof AI_CONSTANTS.KEYPOINT_NAMES[number];
