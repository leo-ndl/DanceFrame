import { PoseFrameResult } from '@/core/ai/types/ml.types';
import { KeypointName } from '@/config/constants/ai';

export interface BufferDerivedMetrics {
  smoothness: number;
  balance: number;
  stability: number;
  symmetry: number;
  rangeOfMotion: number;
  movementSpeed: number;
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
// Per-frame whole-body velocity signal, shared by smoothness (variance) and
// rhythm consistency (peak-interval) calculations so both agree on what
// "movement speed" means at each instant.
export function frameVelocities(buffer: PoseFrameResult[]): number[] {
  const velocities: number[] = [];
  for (let i = 1; i < buffer.length; i++) {
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
  return velocities;
}

export function computeFromBuffer(buffer: PoseFrameResult[]): BufferDerivedMetrics {
  if (buffer.length < 2) {
    return { smoothness: 0.5, balance: 0.5, stability: 0.5, symmetry: 0.5, rangeOfMotion: 0, movementSpeed: 0 };
  }

  const n = buffer.length;

  // Smoothness: inverse of velocity variance
  const velocities = frameVelocities(buffer);
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

  return { smoothness, balance, stability, symmetry, rangeOfMotion, movementSpeed: meanVel };
}

export type BodyRegion = 'Arms' | 'Legs' | 'Torso' | 'Head';

export const KEYPOINT_REGION: Record<KeypointName, BodyRegion> = {
  nose: 'Head', leftEye: 'Head', rightEye: 'Head', leftEar: 'Head', rightEar: 'Head',
  leftShoulder: 'Arms', rightShoulder: 'Arms', leftElbow: 'Arms', rightElbow: 'Arms',
  leftWrist: 'Arms', rightWrist: 'Arms',
  leftHip: 'Torso', rightHip: 'Torso',
  leftKnee: 'Legs', rightKnee: 'Legs', leftAnkle: 'Legs', rightAnkle: 'Legs',
};

/**
 * Active body regions (FR-1): ranks keypoints by total displacement across
 * the buffer, maps the top movers to body regions, and returns up to topN
 * distinct regions ordered by how much they moved.
 */
export function computeActiveRegions(buffer: PoseFrameResult[], topN = 2): BodyRegion[] {
  if (buffer.length < 2) return [];

  const first = buffer[0];
  const kpCount = first.keypoints.length;
  const displacement = new Array<number>(kpCount).fill(0);

  for (let i = 1; i < buffer.length; i++) {
    const prevFrame = buffer[i - 1];
    const frame = buffer[i];
    const count = Math.min(kpCount, frame.keypoints.length, prevFrame.keypoints.length);
    for (let j = 0; j < count; j++) {
      const a = prevFrame.keypoints[j];
      const b = frame.keypoints[j];
      if (a && b) displacement[j] += Math.hypot(b.x - a.x, b.y - a.y);
    }
  }

  const ranked = displacement
    .map((dist, idx) => ({ dist, name: first.keypoints[idx]?.name }))
    .filter((e): e is { dist: number; name: KeypointName } => !!e.name)
    .sort((a, b) => b.dist - a.dist);

  const regions: BodyRegion[] = [];
  for (const { name } of ranked) {
    const region = KEYPOINT_REGION[name];
    if (!regions.includes(region)) regions.push(region);
    if (regions.length >= topN) break;
  }
  return regions;
}

const RHYTHM_PEAK_FACTOR = 1.2;
const RHYTHM_MIN_PEAKS = 2;
const RHYTHM_NEUTRAL = 0.5;

/**
 * Rhythm consistency (FR-1/FR-2): coefficient-of-variation of the intervals
 * between velocity peaks in the whole-body motion signal. Steady, on-beat
 * movement produces evenly spaced peaks (low variance -> high consistency);
 * erratic movement produces irregular spacing (high variance -> low score).
 * Falls back to a neutral 0.5 when there isn't enough signal to judge from,
 * mirroring this file's existing < 2-frame neutral-default convention.
 */
export function computeRhythmConsistency(buffer: PoseFrameResult[]): number {
  if (buffer.length < 3) return RHYTHM_NEUTRAL;

  const velocities = frameVelocities(buffer);
  const meanVel = velocities.reduce((s, v) => s + v, 0) / velocities.length;
  if (meanVel <= 0) return RHYTHM_NEUTRAL;

  const peakTimestamps: number[] = [];
  for (let i = 1; i < velocities.length - 1; i++) {
    const isLocalMax = velocities[i] >= velocities[i - 1] && velocities[i] >= velocities[i + 1];
    if (isLocalMax && velocities[i] > meanVel * RHYTHM_PEAK_FACTOR) {
      // velocities[i] corresponds to the gap between buffer[i] and buffer[i+1]
      peakTimestamps.push(buffer[i + 1].timestamp);
    }
  }

  if (peakTimestamps.length < RHYTHM_MIN_PEAKS) return RHYTHM_NEUTRAL;

  const intervals: number[] = [];
  for (let i = 1; i < peakTimestamps.length; i++) {
    intervals.push(peakTimestamps[i] - peakTimestamps[i - 1]);
  }
  const meanInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;
  if (meanInterval <= 0) return RHYTHM_NEUTRAL;

  const variance = intervals.reduce((s, v) => s + (v - meanInterval) ** 2, 0) / intervals.length;
  const stddev = Math.sqrt(variance);
  return clamp01(1 - stddev / meanInterval);
}
