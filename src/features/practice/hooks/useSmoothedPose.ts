import { useMemo, useRef } from 'react';
import { PoseFrameResult, PoseKeypoint } from '@/core/ai/types/ml.types';

const MAX_GAP_MS = 500;

// Exponential smoothing for rendering only — keeps the skeleton overlay from
// hard-snapping to raw per-frame ML Kit noise. Scoring/comparison code must
// keep consuming the raw pose; blending here introduces lag.
export function useSmoothedPose(pose: PoseFrameResult | null, alpha = 0.4): PoseFrameResult | null {
  const prevKeypointsRef = useRef<PoseKeypoint[] | null>(null);
  const prevTimestampRef = useRef<number | null>(null);

  return useMemo(() => {
    if (!pose) {
      prevKeypointsRef.current = null;
      prevTimestampRef.current = null;
      return null;
    }

    const prevKeypoints = prevKeypointsRef.current;
    const prevTimestamp = prevTimestampRef.current;
    const gapMs = prevTimestamp != null ? pose.timestamp - prevTimestamp : 0;
    const discontinuous =
      !prevKeypoints || prevKeypoints.length !== pose.keypoints.length || gapMs > MAX_GAP_MS || gapMs < 0;

    const keypoints = discontinuous
      ? pose.keypoints
      : pose.keypoints.map((kp, i) => {
          const prev = prevKeypoints![i];
          return {
            ...kp,
            x: prev.x + (kp.x - prev.x) * alpha,
            y: prev.y + (kp.y - prev.y) * alpha,
          };
        });

    prevKeypointsRef.current = keypoints;
    prevTimestampRef.current = pose.timestamp;

    return { ...pose, keypoints };
  }, [pose, alpha]);
}
