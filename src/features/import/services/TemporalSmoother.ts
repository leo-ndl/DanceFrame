import { PoseFrameResult, PoseKeypoint } from '@/core/ai/types/ml.types';

// EMA alpha: higher = more responsive, lower = smoother. 0.35 is a good balance.
const ALPHA = 0.35;

export function smoothPoseStream(frames: PoseFrameResult[]): PoseFrameResult[] {
  if (frames.length === 0) return [];

  const result: PoseFrameResult[] = [];
  // Running EMA state: x and y per keypoint index
  let emaX: number[] = frames[0].keypoints.map(k => k.x);
  let emaY: number[] = frames[0].keypoints.map(k => k.y);

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const kps = frame.keypoints;
    const smoothed: PoseKeypoint[] = kps.map((kp, idx) => {
      // Only update EMA when keypoint is visible enough to trust
      if (kp.confidence > 0.3) {
        emaX[idx] = ALPHA * kp.x + (1 - ALPHA) * (emaX[idx] ?? kp.x);
        emaY[idx] = ALPHA * kp.y + (1 - ALPHA) * (emaY[idx] ?? kp.y);
      }
      return {
        name: kp.name,
        x: emaX[idx] ?? kp.x,
        y: emaY[idx] ?? kp.y,
        confidence: kp.confidence,
      };
    });

    result.push({
      keypoints: smoothed,
      timestamp: frame.timestamp,
      confidence: frame.confidence,
      frameWidth: frame.frameWidth,
      frameHeight: frame.frameHeight,
    });
  }

  return result;
}
