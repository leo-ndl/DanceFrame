import { PoseStreamFrame } from '../types/motion.types';

// Joints monitored for direction reversals (mirrors PoseSequenceExtractor)
const VELOCITY_JOINTS = [5, 6, 7, 8, 9, 10]; // shoulders, elbows, wrists

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function adaptiveCount(durationMs: number, complexityScore: number): number {
  const durationSec = durationMs / 1000;
  return clamp(Math.ceil(durationSec * complexityScore * 2), 1, 5);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * p)] ?? 0;
}

function detectCandidateIndices(
  frames: PoseStreamFrame[],
  threshold: number,
): number[] {
  const selected = new Set<number>();
  selected.add(0);
  selected.add(frames.length - 1);

  // Local maxima above threshold
  for (let i = 1; i < frames.length - 1; i++) {
    const score = frames[i].complexityScore;
    if (
      score > threshold &&
      score >= (frames[i - 1]?.complexityScore ?? 0) &&
      score >= (frames[i + 1]?.complexityScore ?? 0)
    ) {
      selected.add(i);
    }
  }

  // Direction reversals on key joints
  for (let i = 1; i < frames.length - 1; i++) {
    for (const joint of VELOCITY_JOINTS) {
      const prevKp = frames[i - 1].keypoints[joint];
      const currKp = frames[i].keypoints[joint];
      const nextKp = frames[i + 1].keypoints[joint];
      if (!prevKp || !currKp || !nextKp) continue;
      const prevDx = currKp.x - prevKp.x;
      const nextDx = nextKp.x - currKp.x;
      const prevDy = currKp.y - prevKp.y;
      const nextDy = nextKp.y - currKp.y;
      if (
        (prevDx !== 0 && nextDx !== 0 && Math.sign(prevDx) !== Math.sign(nextDx)) ||
        (prevDy !== 0 && nextDy !== 0 && Math.sign(prevDy) !== Math.sign(nextDy))
      ) {
        selected.add(i);
        break;
      }
    }
  }

  // Collapse candidates within 3 frames (keep highest score)
  const sorted = [...selected].sort((a, b) => a - b);
  const merged: number[] = [];
  for (const idx of sorted) {
    const last = merged[merged.length - 1];
    if (last !== undefined && idx - last <= 3) {
      const lastScore = frames[last]?.complexityScore ?? 0;
      const currScore = frames[idx]?.complexityScore ?? 0;
      if (currScore > lastScore) merged[merged.length - 1] = idx;
    } else {
      merged.push(idx);
    }
  }

  return merged;
}

export function generateTeachingPoses(
  segmentFrames: PoseStreamFrame[],
  durationMs: number,
  complexityScore: number,
): PoseStreamFrame[] {
  if (segmentFrames.length === 0) return [];
  if (segmentFrames.length === 1) return [segmentFrames[0]];

  const targetCount = adaptiveCount(durationMs, complexityScore);

  const scores = segmentFrames.map(f => f.complexityScore);
  let threshold = percentile(scores, 0.6);
  let candidates = detectCandidateIndices(segmentFrames, threshold);

  // Adjust threshold to hit target count
  for (let attempt = 0; attempt < 6 && candidates.length !== targetCount; attempt++) {
    if (candidates.length > targetCount) {
      threshold *= 1.4;
    } else {
      threshold *= 0.6;
    }
    candidates = detectCandidateIndices(segmentFrames, threshold);
  }

  // Trim or pad to target
  if (candidates.length > targetCount) {
    // Keep the highest-scoring candidates
    const withScores = candidates.map(i => ({
      i,
      score: segmentFrames[i]?.complexityScore ?? 0,
    }));
    withScores.sort((a, b) => b.score - a.score);
    candidates = withScores
      .slice(0, targetCount)
      .map(x => x.i)
      .sort((a, b) => a - b);
  } else if (candidates.length < targetCount) {
    // Pad with highest-motion frames not already chosen
    const chosen = new Set(candidates);
    const extras = segmentFrames
      .map((f, i) => ({ i, score: f.complexityScore }))
      .filter(x => !chosen.has(x.i))
      .sort((a, b) => b.score - a.score)
      .slice(0, targetCount - candidates.length)
      .map(x => x.i);
    candidates = [...candidates, ...extras].sort((a, b) => a - b);
  }

  return candidates
    .filter(i => i >= 0 && i < segmentFrames.length)
    .map(i => segmentFrames[i]);
}
