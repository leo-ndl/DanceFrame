export const AI_CONSTANTS = {
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
};

export type KeypointName = typeof AI_CONSTANTS.KEYPOINT_NAMES[number];
