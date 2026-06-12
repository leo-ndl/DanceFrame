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

export interface PracticeSessionState {
  isActive: boolean;
  currentScore: number;
  combo: number;
  feedback: string | null;
  currentReferencePose: PoseFrameResult | null;
  nextReferencePose: PoseFrameResult | null;
  beatIntervalMs: number;
  repsCompleted: number;
  sessionId: string | null;
  start: () => void;
  stop: () => string | null;
  onNewPose: (pose: PoseFrameResult) => void;
}

export function usePracticeSession(move: Move | null): PracticeSessionState {
  const [isActive, setIsActive] = useState(false);
  const [currentScore, setCurrentScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [currentReferencePose, setCurrentReferencePose] = useState<PoseFrameResult | null>(null);
  const [nextReferencePose, setNextReferencePose] = useState<PoseFrameResult | null>(null);
  const [repsCompleted, setRepsCompleted] = useState(0);
  const [sessionId] = useState(() => generateId());

  const frameIndexRef = useRef(0);
  const beatIntervalMsRef = useRef(0);
  const beatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scoreHistoryRef = useRef<number[]>([]);
  const comboRef = useRef(0);
  const startTimeRef = useRef(0);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const beatMs = move ? 60000 / move.bpm : 500;

  const advanceReferenceFrame = useCallback(() => {
    if (!move || move.referencePoses.length === 0) return;
    const poses = move.referencePoses;
    frameIndexRef.current = (frameIndexRef.current + 1) % poses.length;
    if (frameIndexRef.current === 0) {
      setRepsCompleted(r => r + 1);
    }
    const nextIdx = (frameIndexRef.current + 1) % poses.length;
    setCurrentReferencePose(poses[frameIndexRef.current] ?? null);
    setNextReferencePose(poses[nextIdx] ?? null);
  }, [move]);

  const start = useCallback(() => {
    if (!move) return;
    frameIndexRef.current = 0;
    scoreHistoryRef.current = [];
    comboRef.current = 0;
    startTimeRef.current = Date.now();
    setCurrentScore(0);
    setCombo(0);
    setRepsCompleted(0);
    setFeedback(null);
    if (move.referencePoses.length > 0) {
      setCurrentReferencePose(move.referencePoses[0]);
      setNextReferencePose(move.referencePoses[1] ?? move.referencePoses[0]);
    }
    const quarterBeat = beatMs / 4;
    beatIntervalMsRef.current = quarterBeat;
    beatIntervalRef.current = setInterval(advanceReferenceFrame, quarterBeat);
    setIsActive(true);
  }, [move, beatMs, advanceReferenceFrame]);

  const stop = useCallback((): string | null => {
    if (beatIntervalRef.current) clearInterval(beatIntervalRef.current);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    setIsActive(false);

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
      if (!isActive || !currentReferencePose) return;

      const result: ComparisonResult = movementComparison.compare(pose, currentReferencePose);
      const score = result.overallScore;

      scoreHistoryRef.current = [...scoreHistoryRef.current.slice(-29), score];
      const rollingAvg = Math.round(
        scoreHistoryRef.current.reduce((a, b) => a + b, 0) / scoreHistoryRef.current.length,
      );
      setCurrentScore(rollingAvg);

      // Combo tracking
      if (score >= 70) {
        comboRef.current += 1;
      } else {
        comboRef.current = 0;
      }
      setCombo(comboRef.current);

      // Micro-feedback every ~2 seconds (every 20 frames at 10fps)
      if (scoreHistoryRef.current.length % 20 === 0) {
        const msgs = feedbackGenerator.generate(result);
        if (msgs.length > 0) showFeedback(msgs[0]);
      }

      // Special combo feedback
      if (comboRef.current === 5) showFeedback('🔥 On Fire! Keep it up!');
      if (comboRef.current === 10) showFeedback('🚀 Combo x10! Incredible!');
    },
    [isActive, currentReferencePose, showFeedback],
  );

  useEffect(() => {
    return () => {
      if (beatIntervalRef.current) clearInterval(beatIntervalRef.current);
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  return {
    isActive,
    currentScore,
    combo,
    feedback,
    currentReferencePose,
    nextReferencePose,
    beatIntervalMs: beatIntervalMsRef.current,
    repsCompleted,
    sessionId,
    start,
    stop,
    onNewPose,
  };
}
