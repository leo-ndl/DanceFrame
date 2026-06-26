import { PoseFrameResult } from '@/core/ai/types/ml.types';

// ── Tunable constants ────────────────────────────────────────────────────────

const QUALITY_MIN_CONFIDENCE = 0.5;
const ANCHOR_MIN_CONFIDENCE = 0.4;
const MOTION_WINDOW = 3;
const DUPLICATE_SIMILARITY_THRESHOLD = 0.95;
const CONTINUITY_MIN_DIFF = 0.20;
const CONTINUITY_MAX_DIFF = 0.80;
// Max realistic normalised-space distance between identical joints across frames.
const EXPECTED_MAX_DISTANCE = 0.5;
// Keypoint indices in POSE_KEYPOINT_ORDER (nose→…→rightAnkle)
const IDX = {
  leftShoulder: 5,
  rightShoulder: 6,
  leftHip: 11,
  rightHip: 12,
  leftElbow: 7,
  rightElbow: 8,
  leftWrist: 9,
  rightWrist: 10,
} as const;

// Joints monitored for direction reversals (FR-5)
const VELOCITY_JOINTS = [
  IDX.leftWrist, IDX.rightWrist,
  IDX.leftElbow, IDX.rightElbow,
  IDX.leftShoulder, IDX.rightShoulder,
];

// Target pose count ranges keyed by duration bucket (FR-9)
const COUNT_TARGETS: Array<{ maxSec: number; min: number; max: number }> = [
  { maxSec: 8,  min: 3, max: 5  },
  { maxSec: 15, min: 5, max: 8  },
  { maxSec: 25, min: 8, max: 12 },
  { maxSec: Infinity, min: 10, max: 20 },
];

// ── Public types ─────────────────────────────────────────────────────────────

export interface PoseExtractionResult {
  keyPoses: PoseFrameResult[];
  totalInputFrames: number;
  rejectedFrames: number;
  /** Smoothed per-frame motion scores — useful for UI sparklines / debug. */
  motionProfile: number[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function dist2D(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function avgKeypointConfidence(frame: PoseFrameResult): number {
  const kps = frame.keypoints;
  if (kps.length === 0) return 0;
  return kps.reduce((s, k) => s + k.confidence, 0) / kps.length;
}

function anchorConfidenceOk(frame: PoseFrameResult): boolean {
  const kps = frame.keypoints;
  const anchors = [IDX.leftHip, IDX.rightHip, IDX.leftShoulder, IDX.rightShoulder];
  return anchors.every(i => (kps[i]?.confidence ?? 0) >= ANCHOR_MIN_CONFIDENCE);
}

interface NormalisedFrame {
  original: PoseFrameResult;
  /** Keypoints shifted to hip-centre origin, scaled by torso height. */
  nx: number[];
  ny: number[];
  motionScore: number;
}

function normalise(frame: PoseFrameResult): NormalisedFrame {
  const kps = frame.keypoints;
  const lh = kps[IDX.leftHip];
  const rh = kps[IDX.rightHip];
  const ls = kps[IDX.leftShoulder];
  const rs = kps[IDX.rightShoulder];

  const hipCx = ((lh?.x ?? 0) + (rh?.x ?? 0)) / 2;
  const hipCy = ((lh?.y ?? 0) + (rh?.y ?? 0)) / 2;
  const sCx = ((ls?.x ?? 0) + (rs?.x ?? 0)) / 2;
  const sCy = ((ls?.y ?? 0) + (rs?.y ?? 0)) / 2;

  const torsoH = Math.abs(sCy - hipCy);
  const scale = torsoH < 0.01 ? 1 : torsoH;

  const nx = kps.map(k => (k.x - hipCx) / scale);
  const ny = kps.map(k => (k.y - hipCy) / scale);

  return { original: frame, nx, ny, motionScore: 0 };
}

function frameMotion(a: NormalisedFrame, b: NormalisedFrame): number {
  let total = 0;
  const n = Math.min(a.nx.length, b.nx.length);
  for (let i = 0; i < n; i++) {
    total += dist2D(a.nx[i], a.ny[i], b.nx[i], b.ny[i]);
  }
  return total;
}

function avgFrameDist(a: NormalisedFrame, b: NormalisedFrame): number {
  const n = Math.min(a.nx.length, b.nx.length);
  if (n === 0) return 0;
  return frameMotion(a, b) / n;
}

function smoothScores(scores: number[], window: number): number[] {
  const out: number[] = [];
  const half = Math.floor(window / 2);
  for (let i = 0; i < scores.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(scores.length - 1, i + half); j++) {
      sum += scores[j];
      count++;
    }
    out.push(count > 0 ? sum / count : 0);
  }
  return out;
}

function countTarget(durationMs: number): { min: number; max: number } {
  const sec = durationMs / 1000;
  for (const bucket of COUNT_TARGETS) {
    if (sec <= bucket.maxSec) return { min: bucket.min, max: bucket.max };
  }
  return { min: 10, max: 20 };
}

// ── Core pipeline ────────────────────────────────────────────────────────────

class PoseSequenceExtractor {
  extract(
    rawFrames: PoseFrameResult[],
    durationMs: number,
  ): PoseExtractionResult {
    const total = rawFrames.length;

    // ── Step 1: Quality filter (FR-10) ──────────────────────────────────────
    const qualified = rawFrames.filter(
      f =>
        avgKeypointConfidence(f) >= QUALITY_MIN_CONFIDENCE &&
        anchorConfidenceOk(f),
    );
    const rejected = total - qualified.length;

    if (qualified.length < 2) {
      return { keyPoses: qualified, totalInputFrames: total, rejectedFrames: rejected, motionProfile: [] };
    }

    // ── Step 2: Normalise (FR-3) ─────────────────────────────────────────────
    const normed = qualified.map(normalise);

    // ── Step 3: Motion scores (FR-4) ─────────────────────────────────────────
    const rawScores: number[] = [0];
    for (let i = 1; i < normed.length; i++) {
      rawScores.push(frameMotion(normed[i - 1], normed[i]));
    }
    const scores = smoothScores(rawScores, MOTION_WINDOW);
    normed.forEach((f, i) => { f.motionScore = scores[i]; });

    const { min: minTarget, max: maxTarget } = countTarget(durationMs);

    // ── Steps 4–8 with adaptive threshold ────────────────────────────────────
    let threshold = this.autoThreshold(scores);
    let keyPoses: PoseFrameResult[] = [];

    for (let attempt = 0; attempt < 6; attempt++) {
      const candidates = this.detectCandidates(normed, scores, threshold);
      const deduped = this.removeDuplicates(candidates);
      const continuous = this.validateContinuity(deduped, normed);
      keyPoses = continuous.map(n => n.original);

      if (keyPoses.length >= minTarget && keyPoses.length <= maxTarget) break;

      if (keyPoses.length > maxTarget) {
        threshold *= 1.35;
      } else {
        threshold *= 0.65;
      }
    }

    // If still under minimum, pad with the highest-motion frames not already chosen.
    if (keyPoses.length < minTarget) {
      keyPoses = this.padToMinimum(keyPoses, normed, scores, minTarget);
    }

    // ── Step 8: Assert chronological order (FR-7) ────────────────────────────
    keyPoses.sort((a, b) => a.timestamp - b.timestamp);

    return {
      keyPoses,
      totalInputFrames: total,
      rejectedFrames: rejected,
      motionProfile: scores,
    };
  }

  // ── Step 4: Local-maxima + direction-reversal candidates (FR-5) ───────────
  private detectCandidates(
    normed: NormalisedFrame[],
    scores: number[],
    threshold: number,
  ): NormalisedFrame[] {
    const selected = new Set<number>();

    // Always include first and last.
    selected.add(0);
    selected.add(normed.length - 1);

    // Local maxima above threshold.
    for (let i = 1; i < scores.length - 1; i++) {
      if (
        scores[i] > threshold &&
        scores[i] >= scores[i - 1] &&
        scores[i] >= scores[i + 1]
      ) {
        selected.add(i);
      }
    }

    // Joint velocity direction reversals.
    for (let i = 1; i < normed.length - 1; i++) {
      for (const joint of VELOCITY_JOINTS) {
        const prevDx = normed[i].nx[joint] - normed[i - 1].nx[joint];
        const nextDx = normed[i + 1].nx[joint] - normed[i].nx[joint];
        const prevDy = normed[i].ny[joint] - normed[i - 1].ny[joint];
        const nextDy = normed[i + 1].ny[joint] - normed[i].ny[joint];
        if (
          (prevDx !== 0 && nextDx !== 0 && Math.sign(prevDx) !== Math.sign(nextDx)) ||
          (prevDy !== 0 && nextDy !== 0 && Math.sign(prevDy) !== Math.sign(nextDy))
        ) {
          selected.add(i);
          break;
        }
      }
    }

    // Collapse candidates within 3 frames of each other (keep highest score).
    const sorted = [...selected].sort((a, b) => a - b);
    const merged: number[] = [];
    for (const idx of sorted) {
      const last = merged[merged.length - 1];
      if (last !== undefined && idx - last <= 3) {
        if ((scores[idx] ?? 0) > (scores[last] ?? 0)) {
          merged[merged.length - 1] = idx;
        }
      } else {
        merged.push(idx);
      }
    }

    return merged.map(i => normed[i]);
  }

  // ── Step 5: Duplicate removal (FR-6) ─────────────────────────────────────
  private removeDuplicates(candidates: NormalisedFrame[]): NormalisedFrame[] {
    if (candidates.length <= 1) return candidates;
    const kept: NormalisedFrame[] = [candidates[0]];
    for (let i = 1; i < candidates.length; i++) {
      const prev = kept[kept.length - 1];
      const curr = candidates[i];
      const avgDist = avgFrameDist(prev, curr);
      const similarity = Math.max(0, 1 - avgDist / EXPECTED_MAX_DISTANCE);
      if (similarity < DUPLICATE_SIMILARITY_THRESHOLD) {
        kept.push(curr);
      }
    }
    return kept;
  }

  // ── Step 6: Continuity validation (FR-8) ──────────────────────────────────
  private validateContinuity(
    candidates: NormalisedFrame[],
    allNormed: NormalisedFrame[],
  ): NormalisedFrame[] {
    if (candidates.length <= 1) return candidates;
    const result: NormalisedFrame[] = [candidates[0]];

    for (let i = 1; i < candidates.length; i++) {
      const prev = result[result.length - 1];
      const curr = candidates[i];
      const avgDist = avgFrameDist(prev, curr);
      const diff = avgDist / EXPECTED_MAX_DISTANCE;

      if (diff < CONTINUITY_MIN_DIFF) {
        // Too similar — keep whichever has the higher motion score.
        if (curr.motionScore > prev.motionScore) {
          result[result.length - 1] = curr;
        }
        continue;
      }

      if (diff > CONTINUITY_MAX_DIFF) {
        // Teleportation — find best intermediate frame in the original sequence.
        const bridge = this.findBridge(prev, curr, allNormed);
        if (bridge) result.push(bridge);
      }

      result.push(curr);
    }
    return result;
  }

  /** Find the frame in allNormed (between prev and curr by timestamp) with
   *  the best balance between prev-diff and curr-diff (closest to midpoint). */
  private findBridge(
    prev: NormalisedFrame,
    curr: NormalisedFrame,
    allNormed: NormalisedFrame[],
  ): NormalisedFrame | null {
    const tPrev = prev.original.timestamp;
    const tCurr = curr.original.timestamp;
    let bestScore = Infinity;
    let best: NormalisedFrame | null = null;

    for (const frame of allNormed) {
      const t = frame.original.timestamp;
      if (t <= tPrev || t >= tCurr) continue;
      const dA = avgFrameDist(prev, frame) / EXPECTED_MAX_DISTANCE;
      const dB = avgFrameDist(frame, curr) / EXPECTED_MAX_DISTANCE;
      // Prefer the frame that splits the distance most evenly (both sides in [0.2, 0.8]).
      if (dA >= CONTINUITY_MIN_DIFF && dA <= CONTINUITY_MAX_DIFF &&
          dB >= CONTINUITY_MIN_DIFF && dB <= CONTINUITY_MAX_DIFF) {
        const balance = Math.abs(dA - dB);
        if (balance < bestScore) {
          bestScore = balance;
          best = frame;
        }
      }
    }
    return best;
  }

  // ── Step 7 (count optimisation — handled in outer loop) ───────────────────

  private padToMinimum(
    current: PoseFrameResult[],
    allNormed: NormalisedFrame[],
    scores: number[],
    minTarget: number,
  ): PoseFrameResult[] {
    const currentTs = new Set(current.map(p => p.timestamp));
    const candidates = allNormed
      .filter(n => !currentTs.has(n.original.timestamp))
      .sort((a, b) => b.motionScore - a.motionScore);

    const needed = minTarget - current.length;
    const extras = candidates.slice(0, needed).map(n => n.original);
    return [...current, ...extras].sort((a, b) => a.timestamp - b.timestamp);
  }

  private autoThreshold(scores: number[]): number {
    if (scores.length === 0) return 1;
    const sorted = [...scores].sort((a, b) => a - b);
    // Start at the 60th-percentile score as the motion threshold.
    const idx = Math.floor(sorted.length * 0.6);
    return sorted[idx] ?? sorted[sorted.length - 1] ?? 1;
  }
}

export const poseSequenceExtractor = new PoseSequenceExtractor();
