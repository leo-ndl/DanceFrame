import { PoseFrameResult } from '@/core/ai/types/ml.types';

export interface BufferDerivedMetrics {
  smoothness: number;
  balance: number;
  stability: number;
  symmetry: number;
  rangeOfMotion: number;
}

export const IDX_LEFT_HIP = 11;
export const IDX_RIGHT_HIP = 12;
export const SYMMETRY_PAIRS: [number, number][] = [
  [5, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16],
];

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Derives smoothness/balance/stability/symmetry/rangeOfMotion from a raw pose
 * buffer. Shared by useMetrics (practice flow) and useDrillScoring's heuristic
 * activity-score path (training flow, drills with no reference pose to compare
 * against) so both use identical velocity/hip-position math.
 */
export function computeFromBuffer(buffer: PoseFrameResult[]): BufferDerivedMetrics {
  if (buffer.length < 2) {
    return { smoothness: 0.5, balance: 0.5, stability: 0.5, symmetry: 0.5, rangeOfMotion: 0 };
  }

  const n = buffer.length;

  // Smoothness: inverse of velocity variance
  const velocities: number[] = [];
  for (let i = 1; i < n; i++) {
    const dt = (buffer[i].timestamp - buffer[i - 1].timestamp) || 1;
    let totalDist = 0;
    const kpCount = Math.min(buffer[i].keypoints.length, buffer[i - 1].keypoints.length);
    for (let j = 0; j < kpCount; j++) {
      const a = buffer[i - 1].keypoints[j];
      const b = buffer[i].keypoints[j];
      if (a && b) totalDist += Math.hypot(b.x - a.x, b.y - a.y) / dt;
    }
    velocities.push(totalDist / kpCount);
  }
  const meanVel = velocities.reduce((s, v) => s + v, 0) / velocities.length;
  const velVar = velocities.reduce((s, v) => s + (v - meanVel) ** 2, 0) / velocities.length;
  const smoothness = clamp01(1 / (1 + velVar * 1000));

  // Balance & stability from hip centre
  const hipXs = buffer.map(f => {
    const lh = f.keypoints[IDX_LEFT_HIP];
    const rh = f.keypoints[IDX_RIGHT_HIP];
    return ((lh?.x ?? 0.5) + (rh?.x ?? 0.5)) / 2;
  });
  const hipYs = buffer.map(f => {
    const lh = f.keypoints[IDX_LEFT_HIP];
    const rh = f.keypoints[IDX_RIGHT_HIP];
    return ((lh?.y ?? 0.5) + (rh?.y ?? 0.5)) / 2;
  });

  const avgHipX = hipXs.reduce((s, v) => s + v, 0) / n;
  const balance = clamp01(1 - Math.abs(avgHipX - 0.5) * 4);

  const hipYVar = hipYs.reduce((s, v) => s + (v - (hipYs.reduce((a, b) => a + b, 0) / n)) ** 2, 0) / n;
  const stability = clamp01(1 / (1 + hipYVar * 200));

  // Symmetry: cosine similarity of mirrored L/R vectors
  let symSum = 0;
  let symCount = 0;
  for (const frame of buffer) {
    const kps = frame.keypoints;
    for (const [lIdx, rIdx] of SYMMETRY_PAIRS) {
      const l = kps[lIdx];
      const r = kps[rIdx];
      if (!l || !r) continue;
      const rMirX = 1 - r.x;
      const dot = l.x * rMirX + l.y * r.y;
      const magL = Math.hypot(l.x, l.y);
      const magR = Math.hypot(rMirX, r.y);
      if (magL > 0 && magR > 0) {
        symSum += clamp01(dot / (magL * magR));
        symCount++;
      }
    }
  }
  const symmetry = symCount > 0 ? clamp01(symSum / symCount) : 0.5;

  // Range of motion: max bounding box diagonal
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const frame of buffer) {
    for (const kp of frame.keypoints) {
      if ((kp.confidence ?? 0) > 0.3) {
        minX = Math.min(minX, kp.x);
        maxX = Math.max(maxX, kp.x);
        minY = Math.min(minY, kp.y);
        maxY = Math.max(maxY, kp.y);
      }
    }
  }
  const rangeOfMotion = minX === Infinity ? 0 : clamp01(Math.hypot(maxX - minX, maxY - minY));

  return { smoothness, balance, stability, symmetry, rangeOfMotion };
}
