import { PoseStreamFrame, MovementMetadata } from '../types/motion.types';

// Keypoint index pairs for L/R symmetry comparison
const SYMMETRY_PAIRS: [number, number][] = [
  [5, 6],   // shoulders
  [7, 8],   // elbows
  [9, 10],  // wrists
  [11, 12], // hips
  [13, 14], // knees
  [15, 16], // ankles
];

const IDX_LEFT_HIP = 11;
const IDX_RIGHT_HIP = 12;
const IDX_LEFT_SHOULDER = 5;
const IDX_RIGHT_SHOULDER = 6;

function variance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function computeMetadata(frames: PoseStreamFrame[]): MovementMetadata {
  if (frames.length === 0) {
    return emptyMetadata();
  }

  const kpCount = frames[0].keypoints.length;
  const n = frames.length;

  // ── Joint velocities (distance per ms) ───────────────────────────────────
  const velPerJoint: number[][] = Array.from({ length: kpCount }, () => []);
  const accPerJoint: number[][] = Array.from({ length: kpCount }, () => []);

  for (let i = 1; i < n; i++) {
    const prev = frames[i - 1];
    const curr = frames[i];
    const dt = curr.timestamp - prev.timestamp;
    if (dt <= 0) continue;

    for (let j = 0; j < kpCount; j++) {
      const pKp = prev.keypoints[j];
      const cKp = curr.keypoints[j];
      if (!pKp || !cKp) continue;
      const vel = Math.hypot(cKp.x - pKp.x, cKp.y - pKp.y) / dt;
      velPerJoint[j].push(vel);
    }
  }

  // Acceleration = delta velocity
  for (let j = 0; j < kpCount; j++) {
    const vels = velPerJoint[j];
    for (let i = 1; i < vels.length; i++) {
      accPerJoint[j].push(Math.abs((vels[i] ?? 0) - (vels[i - 1] ?? 0)));
    }
  }

  const jointVelocity: Record<string, number> = {};
  const jointAcceleration: Record<string, number> = {};
  let totalVelVariance = 0;

  for (let j = 0; j < kpCount; j++) {
    const name = frames[0].keypoints[j]?.name ?? String(j);
    const avgVel = velPerJoint[j].length > 0
      ? velPerJoint[j].reduce((s, v) => s + v, 0) / velPerJoint[j].length
      : 0;
    const avgAcc = accPerJoint[j].length > 0
      ? accPerJoint[j].reduce((s, v) => s + v, 0) / accPerJoint[j].length
      : 0;
    jointVelocity[name] = avgVel;
    jointAcceleration[name] = avgAcc;
    totalVelVariance += variance(velPerJoint[j]);
  }

  // ── Smoothness: low variance in velocity = smooth ─────────────────────────
  const avgVelVariance = kpCount > 0 ? totalVelVariance / kpCount : 0;
  const smoothness = clamp01(1 / (1 + avgVelVariance * 1000));

  // ── Balance: hip-centre lateral offset from 0.5 (midline) ────────────────
  const hipOffsets = frames.map(f => {
    const lh = f.keypoints[IDX_LEFT_HIP];
    const rh = f.keypoints[IDX_RIGHT_HIP];
    const cx = ((lh?.x ?? 0.5) + (rh?.x ?? 0.5)) / 2;
    return Math.abs(cx - 0.5);
  });
  const balance = clamp01(1 - (hipOffsets.reduce((s, v) => s + v, 0) / hipOffsets.length) * 4);

  // ── Stability: hip-centre position variance ───────────────────────────────
  const hipCys = frames.map(f => {
    const lh = f.keypoints[IDX_LEFT_HIP];
    const rh = f.keypoints[IDX_RIGHT_HIP];
    return ((lh?.y ?? 0) + (rh?.y ?? 0)) / 2;
  });
  const hipVariance = variance(hipCys);
  const stability = clamp01(1 / (1 + hipVariance * 200));

  // ── Symmetry: cosine similarity of mirrored L/R vectors ─────────────────
  let symSum = 0;
  let symCount = 0;
  for (const frame of frames) {
    const kps = frame.keypoints;
    for (const [lIdx, rIdx] of SYMMETRY_PAIRS) {
      const l = kps[lIdx];
      const r = kps[rIdx];
      if (!l || !r) continue;
      // Mirror right: reflect x around 0.5
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

  // ── Range of motion: max bounding box diagonal ───────────────────────────
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const frame of frames) {
    for (const kp of frame.keypoints) {
      if ((kp.confidence ?? 0) > 0.3) {
        minX = Math.min(minX, kp.x);
        maxX = Math.max(maxX, kp.x);
        minY = Math.min(minY, kp.y);
        maxY = Math.max(maxY, kp.y);
      }
    }
  }
  const rangeOfMotion =
    minX === Infinity ? 0 : Math.hypot(maxX - minX, maxY - minY);

  // ── Energy: sum of per-frame complexity scores ────────────────────────────
  const energy = frames.reduce((s, f) => s + f.complexityScore, 0);

  // ── Avg speed ─────────────────────────────────────────────────────────────
  const avgSpeed = n > 0 ? energy / n : 0;

  // ── Movement density: compressed frames per ms ───────────────────────────
  const durationMs =
    frames.length > 1
      ? (frames[frames.length - 1].timestamp - frames[0].timestamp)
      : 1;
  const movementDensity = n / Math.max(durationMs, 1);

  return {
    avgSpeed,
    jointVelocity,
    jointAcceleration,
    smoothness,
    balance,
    stability,
    symmetry,
    rangeOfMotion,
    energy,
    movementDensity,
  };
}

function emptyMetadata(): MovementMetadata {
  return {
    avgSpeed: 0,
    jointVelocity: {},
    jointAcceleration: {},
    smoothness: 1,
    balance: 1,
    stability: 1,
    symmetry: 1,
    rangeOfMotion: 0,
    energy: 0,
    movementDensity: 0,
  };
}
