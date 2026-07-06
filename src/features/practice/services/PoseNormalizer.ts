import { PoseFrameResult, PoseKeypoint } from '@/core/ai/types/ml.types';

const IDX_LEFT_HIP = 11;
const IDX_RIGHT_HIP = 12;
const IDX_LEFT_SHOULDER = 5;
const IDX_RIGHT_SHOULDER = 6;

// Transforms a single frame's keypoints into body-relative coordinates:
//   origin  = hip midpoint
//   scale   = torso height (hip-mid to shoulder-mid)
// This removes camera-position, camera-distance, and subject-position variation
// from stored coordinates while leaving body mechanics intact (FR-4).
export function normalizeFrame(frame: PoseFrameResult): PoseFrameResult {
  const kps = frame.keypoints;

  const lh = kps[IDX_LEFT_HIP];
  const rh = kps[IDX_RIGHT_HIP];
  const ls = kps[IDX_LEFT_SHOULDER];
  const rs = kps[IDX_RIGHT_SHOULDER];

  const hipCx = ((lh?.x ?? 0) + (rh?.x ?? 0)) / 2;
  const hipCy = ((lh?.y ?? 0) + (rh?.y ?? 0)) / 2;
  const shoulderCy = ((ls?.y ?? 0) + (rs?.y ?? 0)) / 2;
  const torsoH = Math.abs(shoulderCy - hipCy);
  const scale = Math.max(torsoH, 0.01);

  const normalized: PoseKeypoint[] = kps.map(kp => ({
    name: kp.name,
    x: (kp.x - hipCx) / scale,
    y: (kp.y - hipCy) / scale,
    confidence: kp.confidence,
  }));

  return {
    keypoints: normalized,
    timestamp: frame.timestamp,
    confidence: frame.confidence,
    frameWidth: frame.frameWidth,
    frameHeight: frame.frameHeight,
  };
}
