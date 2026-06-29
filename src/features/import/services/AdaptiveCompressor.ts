import { PoseFrameResult } from '@/core/ai/types/ml.types';
import { PoseStreamFrame } from '../types/motion.types';

// Subsampling stride per complexity band
const STRIDE_HIGH = 1;
const STRIDE_MEDIUM = 3;
const STRIDE_LOW = 8;

// Never allow a gap larger than this in the output stream (FR-5)
const MAX_GAP_MS = 500;

// Keypoint indices used for hip-normalised motion scoring
const IDX_LEFT_HIP = 11;
const IDX_RIGHT_HIP = 12;
const IDX_LEFT_SHOULDER = 5;
const IDX_RIGHT_SHOULDER = 6;

function hipCentre(frame: PoseFrameResult): { cx: number; cy: number; scale: number } {
  const kps = frame.keypoints;
  const lh = kps[IDX_LEFT_HIP];
  const rh = kps[IDX_RIGHT_HIP];
  const ls = kps[IDX_LEFT_SHOULDER];
  const rs = kps[IDX_RIGHT_SHOULDER];

  const cx = ((lh?.x ?? 0) + (rh?.x ?? 0)) / 2;
  const cy = ((lh?.y ?? 0) + (rh?.y ?? 0)) / 2;
  const sCy = ((ls?.y ?? 0) + (rs?.y ?? 0)) / 2;
  const torsoH = Math.abs(sCy - cy);
  return { cx, cy, scale: torsoH < 0.01 ? 1 : torsoH };
}

function motionScore(a: PoseFrameResult, b: PoseFrameResult): number {
  const refA = hipCentre(a);
  const refB = hipCentre(b);
  const scale = (refA.scale + refB.scale) / 2;

  let total = 0;
  const n = Math.min(a.keypoints.length, b.keypoints.length);
  for (let i = 0; i < n; i++) {
    const kA = a.keypoints[i];
    const kB = b.keypoints[i];
    const nx1 = ((kA?.x ?? 0) - refA.cx) / scale;
    const ny1 = ((kA?.y ?? 0) - refA.cy) / scale;
    const nx2 = ((kB?.x ?? 0) - refB.cx) / scale;
    const ny2 = ((kB?.y ?? 0) - refB.cy) / scale;
    const dx = nx1 - nx2;
    const dy = ny1 - ny2;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)] ?? 0;
}

export function compressPoseStream(frames: PoseFrameResult[]): PoseStreamFrame[] {
  if (frames.length <= 2) {
    return frames.map((f, i) => ({
      timestamp: f.timestamp,
      keypoints: f.keypoints,
      confidence: f.confidence,
      complexityScore: 0,
    }));
  }

  // Step 1: compute per-frame motion scores
  const scores: number[] = [0];
  for (let i = 1; i < frames.length; i++) {
    scores.push(motionScore(frames[i - 1], frames[i]));
  }

  // Step 2: define complexity bands from P25/P75
  const sortedScores = [...scores].sort((a, b) => a - b);
  const p25 = percentile(sortedScores, 0.25);
  const p75 = percentile(sortedScores, 0.75);

  const complexity = scores.map(s =>
    s >= p75 ? 'high' : s >= p25 ? 'medium' : 'low',
  );

  // Step 3: stride-based subsampling
  const keepIndices = new Set<number>();
  keepIndices.add(0);
  keepIndices.add(frames.length - 1);

  let counter = 0;
  for (let i = 1; i < frames.length - 1; i++) {
    const stride =
      complexity[i] === 'high'
        ? STRIDE_HIGH
        : complexity[i] === 'medium'
        ? STRIDE_MEDIUM
        : STRIDE_LOW;

    counter++;
    if (counter >= stride) {
      keepIndices.add(i);
      counter = 0;
    }
  }

  // Step 4: enforce MAX_GAP_MS — never create a gap > 500ms (FR-5)
  const sortedKept = [...keepIndices].sort((a, b) => a - b);
  const gapFilled = new Set<number>(sortedKept);

  for (let k = 1; k < sortedKept.length; k++) {
    const prevIdx = sortedKept[k - 1];
    const currIdx = sortedKept[k];
    const prevT = frames[prevIdx]?.timestamp ?? 0;
    const currT = frames[currIdx]?.timestamp ?? 0;

    if (currT - prevT > MAX_GAP_MS) {
      // Insert the frame closest to the midpoint
      const midT = (prevT + currT) / 2;
      let bestIdx = prevIdx + 1;
      let bestDelta = Infinity;
      for (let j = prevIdx + 1; j < currIdx; j++) {
        const delta = Math.abs((frames[j]?.timestamp ?? 0) - midT);
        if (delta < bestDelta) {
          bestDelta = delta;
          bestIdx = j;
        }
      }
      gapFilled.add(bestIdx);
    }
  }

  // Step 5: assemble output
  return [...gapFilled]
    .sort((a, b) => a - b)
    .map(i => ({
      timestamp: frames[i].timestamp,
      keypoints: frames[i].keypoints,
      confidence: frames[i].confidence,
      complexityScore: scores[i] ?? 0,
    }));
}
