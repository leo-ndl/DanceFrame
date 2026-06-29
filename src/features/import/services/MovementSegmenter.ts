import { PoseStreamFrame, MovementSegment, SegmentType } from '../types/motion.types';

const MIN_SEGMENT_MS = 400;
const STILLNESS_WINDOW = 5;
const STILLNESS_CONSECUTIVE = 3;

// Keypoint indices (MoveNet 17-point model)
const IDX = {
  leftShoulder: 5, rightShoulder: 6,
  leftElbow: 7,    rightElbow: 8,
  leftWrist: 9,    rightWrist: 10,
  leftHip: 11,     rightHip: 12,
  leftKnee: 13,    rightKnee: 14,
  leftAnkle: 15,   rightAnkle: 16,
} as const;

function rollingAvg(scores: number[], i: number, window: number): number {
  const half = Math.floor(window / 2);
  let sum = 0;
  let count = 0;
  for (let j = Math.max(0, i - half); j <= Math.min(scores.length - 1, i + half); j++) {
    sum += scores[j];
    count++;
  }
  return count > 0 ? sum / count : 0;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * p)] ?? 0;
}

function avgComplexity(frames: PoseStreamFrame[]): number {
  if (frames.length === 0) return 0;
  return frames.reduce((s, f) => s + f.complexityScore, 0) / frames.length;
}

// ── Segment type classifier ───────────────────────────────────────────────────

function classifySegment(frames: PoseStreamFrame[], complexity: number): SegmentType {
  if (frames.length < 2) return 'transition';

  if (complexity < 0.05) return 'freeze';

  // Foot velocity: ankle movement across segment
  let footMotion = 0;
  let armMotion = 0;
  let shoulderRotation = 0;
  let verticalTorso = 0;

  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1].keypoints;
    const curr = frames[i].keypoints;
    const dt = frames[i].timestamp - frames[i - 1].timestamp;
    if (dt <= 0) continue;

    const la = prev[IDX.leftAnkle];
    const ra = prev[IDX.rightAnkle];
    const laC = curr[IDX.leftAnkle];
    const raC = curr[IDX.rightAnkle];
    if (la && laC) footMotion += Math.hypot(laC.x - la.x, laC.y - la.y) / dt;
    if (ra && raC) footMotion += Math.hypot(raC.x - ra.x, raC.y - ra.y) / dt;

    const lw = prev[IDX.leftWrist];
    const rw = prev[IDX.rightWrist];
    const lwC = curr[IDX.leftWrist];
    const rwC = curr[IDX.rightWrist];
    if (lw && lwC) armMotion += Math.hypot(lwC.x - lw.x, lwC.y - lw.y) / dt;
    if (rw && rwC) armMotion += Math.hypot(rwC.x - rw.x, rwC.y - rw.y) / dt;

    const lsP = prev[IDX.leftShoulder];
    const rsP = prev[IDX.rightShoulder];
    const lsC = curr[IDX.leftShoulder];
    const rsC = curr[IDX.rightShoulder];
    if (lsP && rsP && lsC && rsC) {
      const anglePrev = Math.atan2(rsP.y - lsP.y, rsP.x - lsP.x);
      const angleCurr = Math.atan2(rsC.y - lsC.y, rsC.x - lsC.x);
      shoulderRotation += Math.abs(angleCurr - anglePrev);
    }

    const lhP = prev[IDX.leftHip];
    const rhP = prev[IDX.rightHip];
    const lhC = curr[IDX.leftHip];
    const rhC = curr[IDX.rightHip];
    if (lhP && rhP && lhC && rhC) {
      const hipCyPrev = (lhP.y + rhP.y) / 2;
      const hipCyCurr = (lhC.y + rhC.y) / 2;
      verticalTorso += Math.abs(hipCyCurr - hipCyPrev);
    }
  }

  const n = frames.length - 1;
  footMotion /= n;
  armMotion /= n;
  shoulderRotation /= n;
  verticalTorso /= n;

  if (shoulderRotation > 0.08) return 'turn';
  if (footMotion > 0.003) return 'footwork';
  if (verticalTorso > 0.002 && armMotion > 0.002) return 'body_wave';
  if (armMotion > 0.003) return 'arm_wave';
  if (complexity < 0.15) return 'preparation';
  return 'groove';
}

// ── Boundary detection ────────────────────────────────────────────────────────

function detectBoundaryIndices(frames: PoseStreamFrame[]): number[] {
  if (frames.length === 0) return [];
  const scores = frames.map(f => f.complexityScore);
  const p25 = percentile(scores, 0.25);
  const p90 = percentile(scores, 0.90);
  const stillThreshold = p25 * 0.5;

  const boundaries: number[] = [0];
  let stillCount = 0;
  let wasQuiet = false;

  for (let i = 1; i < frames.length; i++) {
    const avg = rollingAvg(scores, i, STILLNESS_WINDOW);

    if (avg <= stillThreshold) {
      stillCount++;
    } else {
      if (stillCount >= STILLNESS_CONSECUTIVE) {
        // Boundary at the start of the stillness window
        const boundaryIdx = Math.max(0, i - stillCount);
        if (boundaries[boundaries.length - 1] !== boundaryIdx) {
          boundaries.push(boundaryIdx);
        }
        wasQuiet = true;
      }
      stillCount = 0;
    }

    // Spike after a quiet period
    if (wasQuiet && scores[i] !== undefined && scores[i] > p90) {
      if (boundaries[boundaries.length - 1] !== i) {
        boundaries.push(i);
      }
      wasQuiet = false;
    }
  }

  boundaries.push(frames.length - 1);
  return [...new Set(boundaries)].sort((a, b) => a - b);
}

// ── Main export ───────────────────────────────────────────────────────────────

export function segmentStream(
  stream: PoseStreamFrame[],
): Omit<MovementSegment, 'metadata' | 'teachingPoses'>[] {
  if (stream.length === 0) return [];

  const boundaries = detectBoundaryIndices(stream);
  const rawSegments: Omit<MovementSegment, 'metadata' | 'teachingPoses'>[] = [];

  for (let b = 0; b < boundaries.length - 1; b++) {
    const startIdx = boundaries[b];
    const endIdx = boundaries[b + 1];
    const segFrames = stream.slice(startIdx, endIdx + 1);
    if (segFrames.length === 0) continue;

    const startMs = segFrames[0].timestamp;
    const endMs = segFrames[segFrames.length - 1].timestamp;
    const durationMs = endMs - startMs;
    const complexity = avgComplexity(segFrames);

    rawSegments.push({
      startMs,
      endMs,
      durationMs,
      poseRange: [startIdx, endIdx],
      complexityScore: complexity,
      segmentType: classifySegment(segFrames, complexity),
    });
  }

  // Merge segments shorter than MIN_SEGMENT_MS into their neighbour
  const merged: Omit<MovementSegment, 'metadata' | 'teachingPoses'>[] = [];
  for (const seg of rawSegments) {
    const last = merged[merged.length - 1];
    if (last && seg.durationMs < MIN_SEGMENT_MS) {
      // Absorb into previous segment
      const combined = stream.slice(last.poseRange[0], seg.poseRange[1] + 1);
      const complexity = avgComplexity(combined);
      merged[merged.length - 1] = {
        startMs: last.startMs,
        endMs: seg.endMs,
        durationMs: seg.endMs - last.startMs,
        poseRange: [last.poseRange[0], seg.poseRange[1]],
        complexityScore: complexity,
        segmentType: classifySegment(combined, complexity),
      };
    } else {
      merged.push(seg);
    }
  }

  return merged.length > 0 ? merged : rawSegments;
}
