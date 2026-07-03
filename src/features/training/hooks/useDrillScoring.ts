import { useEffect, useRef, useState } from 'react';
import { PoseFrameResult } from '@/core/ai/types/ml.types';
import { Move } from '@/features/moves/types/move.types';
import { movesRepository } from '@/core/data/repositories/MovesRepository';
import { normalizeFrame } from '@/features/practice/services/PoseNormalizer';
import { movementComparison } from '@/features/practice/services/movementComparison';
import { ComparisonResult } from '@/features/practice/types/pose.types';
import { computeFromBuffer, clamp01 } from '@/shared/utils/poseMetrics';
import { TrainingDrill } from '../types/training.types';

export type ScoreMode = 'compared' | 'heuristic';

export interface DrillScoringOutput {
  scoreMode: ScoreMode;
  currentScore: number; // rolling avg, 0-100 in either mode
  lastComparison: ComparisonResult | null; // only populated in 'compared' mode
  move: Move | null;
}

const ROLLING_WINDOW = 30;
const HEURISTIC_WINDOW_MS = 2000;

function hasUsablePoseData(move: Move | null): boolean {
  if (!move) return false;
  const streamLen = move.motionRepresentation?.stream.length ?? 0;
  const posesLen = move.referencePoses?.length ?? 0;
  return streamLen > 0 || posesLen > 0;
}

// Drills have no mascot playback to derive progress from, so we approximate
// "where in the reference move we should be" from elapsed time instead —
// same indexed-lookup approach usePracticeSession uses for mascot progress.
function getReferenceFrame(move: Move, progress: number): PoseFrameResult | null {
  const stream = move.motionRepresentation?.stream ?? [];
  if (stream.length > 0) {
    const idx = Math.min(Math.round(progress * (stream.length - 1)), stream.length - 1);
    const f = stream[idx];
    return f ? { keypoints: f.keypoints, timestamp: f.timestamp, confidence: f.confidence } : null;
  }
  const poses = move.referencePoses ?? [];
  if (poses.length > 0) {
    const idx = Math.min(Math.round(progress * (poses.length - 1)), poses.length - 1);
    return poses[idx] ?? null;
  }
  return null;
}

// No ground truth to compare against in heuristic mode — reward controlled,
// energetic movement (not stillness, not jitter) rather than fabricating a
// technique-accuracy number.
function activityToScore(smoothness: number, rangeOfMotion: number): number {
  const energy = clamp01(rangeOfMotion * 2.2);
  const blended = energy * 0.7 + smoothness * 0.3;
  return Math.round(blended * 100);
}

export function useDrillScoring(
  drill: TrainingDrill | null,
  currentPose: PoseFrameResult | null,
  isActive: boolean,
  isPaused: boolean,
  // Identifies a single attempt at a drill — increments on every (re)start,
  // including a manual restart of the same drill where `isActive` never
  // toggles false. Used purely to trigger the per-attempt reset below.
  attemptId: number,
  onScore?: (score: number) => void,
): DrillScoringOutput {
  const [move, setMove] = useState<Move | null>(null);
  const [scoreMode, setScoreMode] = useState<ScoreMode>('heuristic');
  const [currentScore, setCurrentScore] = useState(0);
  const [lastComparison, setLastComparison] = useState<ComparisonResult | null>(null);

  const scoreHistoryRef = useRef<number[]>([]);
  const poseBufferRef = useRef<PoseFrameResult[]>([]);
  const startTimeRef = useRef(0);
  const onScoreRef = useRef(onScore);
  onScoreRef.current = onScore;

  useEffect(() => {
    if (!drill?.moveId) {
      setMove(null);
      return;
    }
    let cancelled = false;
    void movesRepository.getById(drill.moveId).then(m => {
      if (!cancelled) setMove(m);
    });
    return () => {
      cancelled = true;
    };
  }, [drill?.moveId]);

  useEffect(() => {
    setScoreMode(hasUsablePoseData(move) ? 'compared' : 'heuristic');
  }, [move]);

  // Reset rolling state at the start of every attempt (new drill, or a
  // manual restart of the same drill).
  useEffect(() => {
    scoreHistoryRef.current = [];
    poseBufferRef.current = [];
    startTimeRef.current = Date.now();
    setCurrentScore(0);
    setLastComparison(null);
  }, [attemptId]);

  useEffect(() => {
    if (!isActive || isPaused || !currentPose || !drill) return;

    poseBufferRef.current = [...poseBufferRef.current.slice(-59), currentPose];

    let score: number;
    if (scoreMode === 'compared' && move) {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const progress = clamp01(elapsed / Math.max(drill.durationSeconds, 1));
      const refPose = getReferenceFrame(move, progress);
      if (!refPose) return;
      const normalizedUser = normalizeFrame(currentPose);
      const result = movementComparison.compare(normalizedUser, refPose);
      setLastComparison(result);
      score = result.overallScore;
    } else {
      const recent = poseBufferRef.current.filter(
        p => currentPose.timestamp - p.timestamp <= HEURISTIC_WINDOW_MS,
      );
      const derived = computeFromBuffer(recent);
      score = activityToScore(derived.smoothness, derived.rangeOfMotion);
    }

    onScoreRef.current?.(score);

    scoreHistoryRef.current = [...scoreHistoryRef.current.slice(-(ROLLING_WINDOW - 1)), score];
    const rollingAvg = Math.round(
      scoreHistoryRef.current.reduce((a, b) => a + b, 0) / scoreHistoryRef.current.length,
    );
    setCurrentScore(rollingAvg);
  }, [currentPose, isActive, isPaused, drill, scoreMode, move]);

  return { scoreMode, currentScore, lastComparison, move };
}
