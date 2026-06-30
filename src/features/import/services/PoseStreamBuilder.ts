import { PoseFrameResult } from '@/core/ai/types/ml.types';
import { PoseStreamFrame } from '../types/motion.types';

// Computes the per-frame motion score as the sum of Euclidean distances between
// corresponding keypoints in consecutive frames. Since frames are already
// body-normalized (by PoseNormalizer), no additional centering is needed.
function motionMagnitude(a: PoseFrameResult, b: PoseFrameResult): number {
  let total = 0;
  const n = Math.min(a.keypoints.length, b.keypoints.length);
  for (let i = 0; i < n; i++) {
    const ax = a.keypoints[i]?.x ?? 0;
    const ay = a.keypoints[i]?.y ?? 0;
    const bx = b.keypoints[i]?.x ?? 0;
    const by = b.keypoints[i]?.y ?? 0;
    const dx = ax - bx;
    const dy = ay - by;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

// Converts all frames to PoseStreamFrame[] without discarding any frame (FR-1).
// complexityScore is computed from consecutive-frame motion magnitude so that
// downstream services (MovementSegmenter, MetadataComputer, TeachingPoseGenerator)
// continue to work without changes.
// Appends a temporal anchor at durationMs when the last frame's timestamp is
// less than the video duration (FR-3).
export function buildPoseStream(frames: PoseFrameResult[], durationMs: number): PoseStreamFrame[] {
  if (frames.length === 0) return [];

  const stream: PoseStreamFrame[] = frames.map((f, i) => ({
    timestamp: f.timestamp,
    keypoints: f.keypoints,
    confidence: f.confidence,
    complexityScore: i === 0 ? 0 : motionMagnitude(frames[i - 1], f),
  }));

  // Temporal anchor: guarantee stream end aligns with video end (FR-3)
  const last = stream[stream.length - 1];
  if (last && last.timestamp < durationMs) {
    stream.push({ ...last, timestamp: durationMs, complexityScore: 0 });
  }

  return stream;
}
