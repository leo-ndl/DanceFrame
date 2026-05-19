import { EmitterSubscription, NativeEventEmitter, NativeModules } from 'react-native';
import {
  POSE_KEYPOINT_ORDER,
  PoseFrameResult,
  PoseInitOptions,
  PoseKeypoint,
} from '@/core/ai/types/ml.types';
import { logger } from '@/shared/utils/logger';

type NativePoseKeypointPayload = Partial<{
  name: string;
  index: number;
  x: number;
  y: number;
  confidence: number;
  score: number;
}>;

type NativePoseFramePayload = Partial<{
  keypoints: unknown[];
  timestamp: number;
  confidence: number;
  frameWidth: number;
  frameHeight: number;
}>;

interface PoseInferenceNativeModule {
  initialize(options?: PoseInitOptions): Promise<boolean>;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface PoseInferenceStateEvent {
  isInitialized: boolean;
  isRunning: boolean;
}

export interface PoseInferenceErrorEvent {
  code: string;
  message: string;
}

export const POSE_INFERENCE_EVENTS = {
  pose: 'onPose',
  error: 'onPoseError',
  state: 'onPoseState',
} as const;

const MODULE_NAME = 'PoseInferenceModule';
const nativeModule = NativeModules[MODULE_NAME] as PoseInferenceNativeModule | undefined;
const poseEventEmitter = nativeModule ? new NativeEventEmitter(nativeModule as any) : null;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const asFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
};

const asPositiveInteger = (value: unknown): number | undefined => {
  const numericValue = asFiniteNumber(value);
  if (numericValue === undefined || numericValue <= 0) {
    return undefined;
  }
  return Math.round(numericValue);
};

const resolveKeypointName = (payload: NativePoseKeypointPayload, fallbackIndex: number): PoseKeypoint['name'] => {
  const defaultName = POSE_KEYPOINT_ORDER[fallbackIndex] ?? POSE_KEYPOINT_ORDER[0];
  const candidateName = typeof payload.name === 'string' ? payload.name : defaultName;

  if ((POSE_KEYPOINT_ORDER as readonly string[]).includes(candidateName)) {
    return candidateName as PoseKeypoint['name'];
  }

  return defaultName as PoseKeypoint['name'];
};

const normalizeKeypoint = (
  payload: NativePoseKeypointPayload,
  fallbackIndex: number
): PoseKeypoint => {
  const confidenceValue = asFiniteNumber(payload.confidence ?? payload.score) ?? 0;

  return {
    name: resolveKeypointName(payload, fallbackIndex),
    x: clamp01(asFiniteNumber(payload.x) ?? 0),
    y: clamp01(asFiniteNumber(payload.y) ?? 0),
    confidence: clamp01(confidenceValue),
  };
};

const normalizePosePayload = (eventPayload: unknown): PoseFrameResult | null => {
  if (!eventPayload || typeof eventPayload !== 'object') {
    return null;
  }

  const payload = eventPayload as NativePoseFramePayload;
  const rawKeypoints = Array.isArray(payload.keypoints) ? payload.keypoints : [];

  const keypoints = rawKeypoints
    .map((keypoint, index) => {
      if (!keypoint || typeof keypoint !== 'object') {
        return null;
      }
      return normalizeKeypoint(keypoint as NativePoseKeypointPayload, index);
    })
    .filter((keypoint): keypoint is PoseKeypoint => keypoint !== null);

  const fallbackConfidence =
    keypoints.length > 0
      ? keypoints.reduce((total, keypoint) => total + keypoint.confidence, 0) / keypoints.length
      : 0;

  return {
    keypoints,
    timestamp: asFiniteNumber(payload.timestamp) ?? Date.now(),
    confidence: clamp01(asFiniteNumber(payload.confidence) ?? fallbackConfidence),
    frameWidth: asPositiveInteger(payload.frameWidth),
    frameHeight: asPositiveInteger(payload.frameHeight),
  };
};

export const isPoseInferenceAvailable = (): boolean => Boolean(nativeModule);

export const initializePoseInference = async (options: PoseInitOptions = {}): Promise<boolean> => {
  if (!nativeModule) {
    logger.warn('PoseInferenceModule is unavailable. Falling back to JS pipeline.');
    return false;
  }

  return nativeModule.initialize(options);
};

export const startPoseInference = async (): Promise<void> => {
  if (!nativeModule) {
    logger.warn('PoseInferenceModule.start() called, but native module is unavailable.');
    return;
  }

  await nativeModule.start();
};

export const stopPoseInference = async (): Promise<void> => {
  if (!nativeModule) {
    return;
  }

  await nativeModule.stop();
};

export const subscribeToPoseEvents = (
  listener: (result: PoseFrameResult) => void
): EmitterSubscription | null => {
  if (!poseEventEmitter) {
    logger.warn('Pose event subscription skipped because PoseInferenceModule is unavailable.');
    return null;
  }

  return poseEventEmitter.addListener(POSE_INFERENCE_EVENTS.pose, (payload: unknown) => {
    const normalizedPose = normalizePosePayload(payload);
    if (!normalizedPose) {
      return;
    }
    listener(normalizedPose);
  });
};

export const subscribeToPoseState = (
  listener: (state: PoseInferenceStateEvent) => void
): EmitterSubscription | null => {
  if (!poseEventEmitter) {
    return null;
  }

  return poseEventEmitter.addListener(POSE_INFERENCE_EVENTS.state, (payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return;
    }

    const statePayload = payload as Partial<PoseInferenceStateEvent>;
    listener({
      isInitialized: Boolean(statePayload.isInitialized),
      isRunning: Boolean(statePayload.isRunning),
    });
  });
};

export const subscribeToPoseErrors = (
  listener: (error: PoseInferenceErrorEvent) => void
): EmitterSubscription | null => {
  if (!poseEventEmitter) {
    return null;
  }

  return poseEventEmitter.addListener(POSE_INFERENCE_EVENTS.error, (payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      listener({
        code: 'E_UNKNOWN',
        message: 'Unknown pose inference error payload',
      });
      return;
    }

    const errorPayload = payload as Partial<PoseInferenceErrorEvent>;
    listener({
      code: errorPayload.code ?? 'E_UNKNOWN',
      message: errorPayload.message ?? 'Unknown pose inference error',
    });
  });
};

export const poseInferenceBridge = {
  isPoseInferenceAvailable,
  initializePoseInference,
  startPoseInference,
  stopPoseInference,
  subscribeToPoseEvents,
  subscribeToPoseState,
  subscribeToPoseErrors,
};

