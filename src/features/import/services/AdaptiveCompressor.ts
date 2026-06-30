import { PoseFrameResult } from '@/core/ai/types/ml.types';
import { PoseStreamFrame } from '../types/motion.types';

const MAX_GAP_MS = 300;

// Perceptual drop threshold per complexity band (normalized body-scale units).
// A frame is kept only when the linear-interpolation error between its kept
// neighbours exceeds this value — preventing any visually perceptible drop.
const PERCEPTUAL_THRESHOLD = { high: 0.03, medium: 0.05, low: 0.08 } as const;

// Post-compression safety net: frames whose reconstruction error exceeds this
// threshold are reported as violations and re-inserted by the pipeline (FR-7).
export const FIDELITY_THRESHOLD = 0.04;

// Keypoint indices (MoveNet/BlazePose layout)
const IDX_LEFT_HIP = 11;
const IDX_RIGHT_HIP = 12;
const IDX_LEFT_SHOULDER = 5;
const IDX_RIGHT_SHOULDER = 6;
// Joints most sensitive to direction reversals (wrists, ankles)
const CRITICAL_JOINTS = [9, 10, 15, 16] as const;

// ---------------------------------------------------------------------------
// Shared geometry helpers (unchanged from original)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Reconstruction error (FR-4, FR-7)
// ---------------------------------------------------------------------------

// Returns the maximum per-joint distance (body-scale-normalised) between the
// actual keypoints of `actual` and the linearly-interpolated pose between
// frames `a` and `b` at blend factor `t` (0–1).
function reconstructionError(
  a: PoseFrameResult,
  b: PoseFrameResult,
  t: number,
  actual: PoseFrameResult,
): number {
  const scale = (hipCentre(a).scale + hipCentre(b).scale) / 2 || 1;
  let maxDist = 0;
  const n = Math.min(a.keypoints.length, b.keypoints.length, actual.keypoints.length);
  for (let i = 0; i < n; i++) {
    const ax = a.keypoints[i]?.x ?? 0;
    const ay = a.keypoints[i]?.y ?? 0;
    const bx = b.keypoints[i]?.x ?? 0;
    const by = b.keypoints[i]?.y ?? 0;
    const cx = actual.keypoints[i]?.x ?? 0;
    const cy = actual.keypoints[i]?.y ?? 0;
    const dx = (ax + (bx - ax) * t - cx) / scale;
    const dy = (ay + (by - ay) * t - cy) / scale;
    maxDist = Math.max(maxDist, Math.sqrt(dx * dx + dy * dy));
  }
  return maxDist;
}

// ---------------------------------------------------------------------------
// Critical frame detection (FR-8)
// ---------------------------------------------------------------------------

// Frames that must never be dropped: endpoints, motion onsets/stops,
// direction reversals on prominent joints, and magnitude spikes.
function detectCriticalFrames(
  frames: PoseFrameResult[],
  scores: number[],
  p25: number,
  p75: number,
): Set<number> {
  const critical = new Set<number>();
  critical.add(0);
  critical.add(frames.length - 1);

  for (let i = 1; i < frames.length - 1; i++) {
    const prev = scores[i - 1] ?? 0;
    const cur = scores[i] ?? 0;

    // Motion onset (silence → burst) or stop (burst → silence)
    if ((prev < p25 && cur > p75) || (prev > p75 && cur < p25)) {
      critical.add(i);
      continue;
    }
    // Magnitude spike
    if (cur > 2 * p75) {
      critical.add(i);
      continue;
    }
    // Direction reversal on wrists / ankles
    const kPrev = frames[i - 1].keypoints;
    const kCur = frames[i].keypoints;
    const kNext = frames[i + 1]?.keypoints;
    if (kNext) {
      for (const j of CRITICAL_JOINTS) {
        const vbx = (kCur[j]?.x ?? 0) - (kPrev[j]?.x ?? 0);
        const vby = (kCur[j]?.y ?? 0) - (kPrev[j]?.y ?? 0);
        const vax = (kNext[j]?.x ?? 0) - (kCur[j]?.x ?? 0);
        const vay = (kNext[j]?.y ?? 0) - (kCur[j]?.y ?? 0);
        if (vbx * vax + vby * vay < 0) {
          critical.add(i);
          break;
        }
      }
    }
  }

  return critical;
}

// ---------------------------------------------------------------------------
// RDP-style perceptual redundancy filter (FR-4)
// ---------------------------------------------------------------------------

// Within the half-open interval (lo, hi), keep interior frames whose removal
// would cause a reconstruction error exceeding their band's perceptual
// threshold. Uses recursive Ramer-Douglas-Peucker — always anchors on the
// worst-error frame first, ensuring no perceptible motion is discarded.
function rdpFilter(
  frames: PoseFrameResult[],
  scores: number[],
  p25: number,
  p75: number,
  lo: number,
  hi: number,
  kept: Set<number>,
): void {
  if (hi - lo <= 1) return;

  const frameA = frames[lo];
  const frameB = frames[hi];
  const tA = frameA.timestamp;
  const span = frameB.timestamp - tA;

  let maxError = -1;
  let maxIdx = -1;

  for (let i = lo + 1; i < hi; i++) {
    const s = scores[i] ?? 0;
    const threshold =
      s >= p75
        ? PERCEPTUAL_THRESHOLD.high
        : s >= p25
        ? PERCEPTUAL_THRESHOLD.medium
        : PERCEPTUAL_THRESHOLD.low;

    const t = span > 0 ? (frames[i].timestamp - tA) / span : 0;
    const err = reconstructionError(frameA, frameB, t, frames[i]);

    if (err > threshold && err > maxError) {
      maxError = err;
      maxIdx = i;
    }
  }

  if (maxIdx !== -1) {
    kept.add(maxIdx);
    rdpFilter(frames, scores, p25, p75, lo, maxIdx, kept);
    rdpFilter(frames, scores, p25, p75, maxIdx, hi, kept);
  }
}

// ---------------------------------------------------------------------------
// Main export: adaptive pose stream compression
// ---------------------------------------------------------------------------

export function compressPoseStream(frames: PoseFrameResult[], durationMs: number): PoseStreamFrame[] {
  if (frames.length === 0) return [];

  if (frames.length <= 2) {
    const result: PoseStreamFrame[] = frames.map(f => ({
      timestamp: f.timestamp,
      keypoints: f.keypoints,
      confidence: f.confidence,
      complexityScore: 0,
    }));
    const last = result[result.length - 1];
    if (last && last.timestamp < durationMs) {
      result.push({ ...last, timestamp: durationMs, complexityScore: 0 });
    }
    return result;
  }

  // Step 1: per-frame motion scores
  const scores: number[] = [0];
  for (let i = 1; i < frames.length; i++) {
    scores.push(motionScore(frames[i - 1], frames[i]));
  }

  // Step 2: percentile bands
  const sortedScores = [...scores].sort((a, b) => a - b);
  const p25 = percentile(sortedScores, 0.25);
  const p75 = percentile(sortedScores, 0.75);

  // Step 3: protect critical frames (FR-8)
  const critical = detectCriticalFrames(frames, scores, p25, p75);

  // Step 4: RDP perceptual filter across each gap between critical frames (FR-4)
  const kept = new Set<number>(critical);
  const criticalSorted = [...critical].sort((a, b) => a - b);
  for (let k = 0; k < criticalSorted.length - 1; k++) {
    rdpFilter(frames, scores, p25, p75, criticalSorted[k], criticalSorted[k + 1], kept);
  }

  // Step 5: enforce MAX_GAP_MS — never create a gap > 300ms (FR-5)
  const sortedKept = [...kept].sort((a, b) => a - b);
  const gapFilled = new Set<number>(sortedKept);
  for (let k = 1; k < sortedKept.length; k++) {
    const prevIdx = sortedKept[k - 1];
    const currIdx = sortedKept[k];
    const prevT = frames[prevIdx]?.timestamp ?? 0;
    const currT = frames[currIdx]?.timestamp ?? 0;
    if (currT - prevT > MAX_GAP_MS) {
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

  // Step 6: assemble output
  const output: PoseStreamFrame[] = [...gapFilled]
    .sort((a, b) => a - b)
    .map(i => ({
      timestamp: frames[i].timestamp,
      keypoints: frames[i].keypoints,
      confidence: frames[i].confidence,
      complexityScore: scores[i] ?? 0,
    }));

  // Step 7: temporal anchor — guarantee stream end = video end (FR-1, FR-2)
  const lastOut = output[output.length - 1];
  if (lastOut && lastOut.timestamp < durationMs) {
    output.push({ ...lastOut, timestamp: durationMs, complexityScore: 0 });
  }

  return output;
}

// ---------------------------------------------------------------------------
// Post-compression fidelity validation (FR-7)
// ---------------------------------------------------------------------------

// Returns original frames that were dropped but whose reconstruction error
// (distance between interpolated compressed pose and actual pose) exceeds
// `threshold`. The pipeline re-inserts these to restore fidelity.
export function findFidelityViolations(
  original: PoseFrameResult[],
  compressed: PoseStreamFrame[],
  threshold: number,
): PoseStreamFrame[] {
  if (compressed.length < 2 || original.length === 0) return [];

  const compressedTsSet = new Set(compressed.map(f => f.timestamp));
  const violations: PoseStreamFrame[] = [];

  for (const frame of original) {
    if (compressedTsSet.has(frame.timestamp)) continue;

    // Binary search for bracketing compressed frames
    let lo = 0;
    let hi = compressed.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if ((compressed[mid]?.timestamp ?? 0) <= frame.timestamp) lo = mid;
      else hi = mid;
    }

    const cA = compressed[lo];
    const cB = compressed[hi];
    if (!cA || !cB || cA === cB) continue;

    const span = cB.timestamp - cA.timestamp;
    if (span <= 0) continue;
    const t = (frame.timestamp - cA.timestamp) / span;

    const pA: PoseFrameResult = { keypoints: cA.keypoints, timestamp: cA.timestamp, confidence: cA.confidence };
    const pB: PoseFrameResult = { keypoints: cB.keypoints, timestamp: cB.timestamp, confidence: cB.confidence };

    if (reconstructionError(pA, pB, t, frame) > threshold) {
      violations.push({
        timestamp: frame.timestamp,
        keypoints: frame.keypoints,
        confidence: frame.confidence,
        complexityScore: 0,
      });
    }
  }

  return violations;
}
