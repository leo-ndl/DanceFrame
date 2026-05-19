
import { AI_CONSTANTS, KeypointName } from '@/config/constants/ai';

export type ModelType = 'lightning' | 'thunder';

/**
 * Canonical keypoint payload shared between native and JS layers.
 *
 * Constraints:
 * - `x`, `y` are normalized to [0, 1]
 * - `confidence` is normalized to [0, 1]
 * - keypoints are emitted in `POSE_KEYPOINT_ORDER`
 */
export interface PoseKeypoint {
  name: KeypointName;
  x: number;
  y: number;
  confidence: number;
}

/**
 * Frame-level result emitted from the pose pipeline.
 * This is the primary native <-> JS contract for real-time pose streaming.
 */
export interface PoseFrameResult {
  keypoints: PoseKeypoint[];
  timestamp: number;
  confidence: number;
  frameWidth?: number;
  frameHeight?: number;
}

/**
 * Initialization contract for a native pose pipeline.
 */
export interface PoseInitOptions {
  modelType?: ModelType;
  minKeypointConfidence?: number;
  targetFps?: number;
}

export const POSE_KEYPOINT_ORDER = AI_CONSTANTS.KEYPOINT_NAMES;
