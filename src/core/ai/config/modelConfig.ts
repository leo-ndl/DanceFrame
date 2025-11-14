import { Platform } from 'react-native';
import { AI_CONSTANTS } from '@/config/constants/ai';

export const MODEL_CONFIG = {
  lightning: {
    defaultPath: require('@/assets/models/movenet_lightning.tflite'),
    modelPath: Platform.select({
      ios: 'models/movenet_lightning.tflite',
      android: 'movenet_lightning.tflite',
    })!,
    inputSize: AI_CONSTANTS.MODEL_INPUT_SIZE,
    numKeypoints: AI_CONSTANTS.TFLITE.NUM_KEYPOINTS,
    numChannels: AI_CONSTANTS.TFLITE.NUM_CHANNELS,
  },
  thunder: {
    defaultPath: require('@/assets/models/movenet_thunder.tflite'),
    modelPath: Platform.select({
      ios: 'models/movenet_thunder.tflite',
      android: 'movenet_thunder.tflite',
    })!,
    inputSize: AI_CONSTANTS.MODEL_THUNDER_SIZE,
    numKeypoints: AI_CONSTANTS.TFLITE.NUM_KEYPOINTS,
    numChannels: AI_CONSTANTS.TFLITE.NUM_CHANNELS,
  },
};

export const DETECTION_CONFIG = {
  minConfidence: AI_CONSTANTS.MIN_CONFIDENCE,
  frameSkip: AI_CONSTANTS.FRAME_SKIP,
  maxFps: 30,
  targetFps: 10, // AI processing FPS
};