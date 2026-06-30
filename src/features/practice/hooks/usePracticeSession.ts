import { useCallback, useEffect, useRef, useState } from 'react';
import { Move } from '@/features/moves/types/move.types';
import { PoseFrameResult } from '@/core/ai/types/ml.types';
import { movementComparison } from '../services/movementComparison';
import { feedbackGenerator } from '../services/feedbackGenerator';
import { ComparisonResult } from '../types/pose.types';
import { PracticeSession, SessionMetrics } from '../types/session.types';
import { mmkvStorage } from '@/core/storage';
import { STORAGE_KEYS } from '@/config/constants/app';
import { generateId } from '@/shared/utils/helper';
import { movesRepository } from '@/core/data/repositories/MovesRepository';
import { normalizeFrame } from '@/features/import/services/PoseNormalizer';

export interface PracticeSessionState {
  isActive: boolean;
  isPaused: boolean;
  currentScore: number;
  combo: number;
  feedback: string | null;
  currentReferencePose: PoseFrameResult | null;
  repsCompleted: number;
  sessionId: string | null;
  lastComparison: ComparisonResult | null;
  start: () => void;
  stop: () => string | null;
  pause: () => void;
  resume: () => void;
  onNewPose: (pose: PoseFrameResult) => void;
  onMascotProgress: (progress: number) => void;
}

export function usePracticeSession(move: Move | null): PracticeSessionState {
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentScore, setCurrentScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [currentReferencePose, setCurrentReferencePose] = useState<PoseFrameResult | null>(null);
  const [repsCompleted, setRepsCompleted] = useState(0);
  const [lastComparison, setLastComparison] = useState<ComparisonResult | null>(null);
  const [sessionId] = useState(() => generateId());

  const scoreHistoryRef = useRef<number[]>([]);
  const comboRef = useRef(0);
  const startTimeRef = useRef(0);
  const prevProgressRef = useRef(0);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestComparisonRef = useRef<ComparisonResult | null>(null);
  const comparisonFlushRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Driven by mascot playback progress (0–1). Derives the reference pose from
  // the full body-normalized stream so comparison tracks the actual segment
  // being shown, across all segments. Falls back to indexed referencePoses for
  // moves imported before body-normalization was introduced.
  const onMascotProgress = useCallback(
    (progress: number) => {
      if (!isActive || isPaused) return;

      const stream = move?.motionRepresentation?.stream ?? [];
      let refPose: PoseFrameResult | null = null;

      if (stream.length > 0) {
        const idx = Math.min(Math.round(progress * (stream.length - 1)), stream.length - 1);
        const f = stream[idx];
        if (f) refPose = { keypoints: f.keypoints, timestamp: f.timestamp, confidence: f.confidence };
      } else {
        const poses = move?.referencePoses ?? [];
        if (poses.length > 0) {
          const idx = Math.min(Math.round(progress * (poses.length - 1)), poses.length - 1);
          refPose = poses[idx] ?? null;
        }
      }

      setCurrentReferencePose(refPose);

      if (prevProgressRef.current > 0.8 && progress < 0.2) {
        setRepsCompleted(r => r + 1);
      }
      prevProgressRef.current = progress;
    },
    [isActive, isPaused, move],
  );

  const start = useCallback(() => {
    if (!move) return;
    scoreHistoryRef.current = [];
    comboRef.current = 0;
    startTimeRef.current = Date.now();
    latestComparisonRef.current = null;
    prevProgressRef.current = 0;
    setCurrentScore(0);
    setCombo(0);
    setRepsCompleted(0);
    setFeedback(null);
    setLastComparison(null);
    setIsPaused(false);
    const firstStreamFrame = move.motionRepresentation?.stream[0];
    setCurrentReferencePose(
      firstStreamFrame
        ? { keypoints: firstStreamFrame.keypoints, timestamp: firstStreamFrame.timestamp, confidence: firstStreamFrame.confidence }
        : move.referencePoses[0] ?? null,
    );
    comparisonFlushRef.current = setInterval(() => {
      if (latestComparisonRef.current) {
        setLastComparison(latestComparisonRef.current);
      }
    }, 250);
    setIsActive(true);
  }, [move]);

  const pause = useCallback(() => {
    if (!isActive || isPaused) return;
    setIsPaused(true);
  }, [isActive, isPaused]);

  const resume = useCallback(() => {
    if (!isActive || !isPaused) return;
    setIsPaused(false);
  }, [isActive, isPaused]);

  const stop = useCallback((): string | null => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    if (comparisonFlushRef.current) clearInterval(comparisonFlushRef.current);
    setIsActive(false);
    setIsPaused(false);

    const history = scoreHistoryRef.current;
    if (history.length === 0 || !move) return null;

    const avgScore = Math.round(history.reduce((a, b) => a + b, 0) / history.length);
    const metrics: SessionMetrics = {
      timingAccuracy: avgScore,
      movementPrecision: avgScore,
      isolationQuality: avgScore,
      consistency: history.length > 5
        ? Math.round(100 - (Math.max(...history) - Math.min(...history)))
        : avgScore,
    };

    const session: PracticeSession = {
      id: sessionId,
      moveId: move.id,
      startTime: startTimeRef.current,
      endTime: Date.now(),
      score: avgScore,
      repsCompleted,
      feedback: feedbackGenerator.generate({
        overallScore: avgScore,
        timingScore: metrics.timingAccuracy,
        precisionScore: metrics.movementPrecision,
        isolationScore: metrics.isolationQuality,
        jointScores: {},
        errors: [],
      }),
      metrics,
    };

    const existing = mmkvStorage.get<PracticeSession[]>(STORAGE_KEYS.SESSIONS) ?? [];
    mmkvStorage.set(STORAGE_KEYS.SESSIONS, [session, ...existing.slice(0, 49)]);
    void movesRepository.updateProgress(move.id, avgScore);

    return sessionId;
  }, [move, repsCompleted, sessionId]);

  const showFeedback = useCallback((msg: string) => {
    setFeedback(msg);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => setFeedback(null), 2500);
  }, []);

  const onNewPose = useCallback(
    (pose: PoseFrameResult) => {
      if (!isActive || isPaused || !currentReferencePose) return;

      // Normalize live camera pose to body-relative space before comparison so
      // it matches the body-normalized reference stream (FR-4).
      const normalizedPose = normalizeFrame(pose);
      const result: ComparisonResult = movementComparison.compare(normalizedPose, currentReferencePose);
      latestComparisonRef.current = result;
      const score = result.overallScore;

      scoreHistoryRef.current = [...scoreHistoryRef.current.slice(-29), score];
      const rollingAvg = Math.round(
        scoreHistoryRef.current.reduce((a, b) => a + b, 0) / scoreHistoryRef.current.length,
      );
      setCurrentScore(rollingAvg);

      if (score >= 70) {
        comboRef.current += 1;
      } else {
        comboRef.current = 0;
      }
      setCombo(comboRef.current);

      if (scoreHistoryRef.current.length % 20 === 0) {
        const msgs = feedbackGenerator.generate(result);
        if (msgs.length > 0) showFeedback(msgs[0]);
      }

      if (comboRef.current === 5) showFeedback('🔥 On Fire! Keep it up!');
      if (comboRef.current === 10) showFeedback('🚀 Combo x10! Incredible!');
    },
    [isActive, isPaused, currentReferencePose, showFeedback],
  );

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      if (comparisonFlushRef.current) clearInterval(comparisonFlushRef.current);
    };
  }, []);

  return {
    isActive,
    isPaused,
    currentScore,
    combo,
    feedback,
    currentReferencePose,
    repsCompleted,
    sessionId,
    lastComparison,
    start,
    stop,
    pause,
    resume,
    onNewPose,
    onMascotProgress,
  };
}
