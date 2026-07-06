import { useCallback, useEffect, useRef, useState } from 'react';
import { trainingPlanRepository } from '@/core/data/repositories/TrainingPlanRepository';
import { useAppStore } from '@/core/state/store';
import { CompletedDrillResult, CompletedPlanSession, SessionPhase, TrainingDrill } from '../types/training.types';
import { generateId } from '@/shared/utils/helper';

interface PlanSessionState {
  phase: SessionPhase;
  currentDrillIndex: number;
  timeRemaining: number;
  currentDrill: TrainingDrill | null;
  nextDrill: TrainingDrill | null;
  completedDrills: string[];
  currentTipIndex: number;
  sessionStatsId: string | null;
  isPaused: boolean;
  lastDrillResult: CompletedDrillResult | null;
  // Increments every time a drill (re)starts, including a manual restart of
  // the same drill (where `phase` stays 'drill' the whole time and can't be
  // used as a reset signal). useDrillScoring keys its per-attempt reset off
  // this instead of drill id + isActive.
  drillAttemptId: number;
  start: () => void;
  abort: () => CompletedPlanSession | null;
  pause: () => void;
  resume: () => void;
  restartDrill: () => void;
}

// Screen-supplied getter: at the exact moment a drill's timer ends, usePlanSession
// asks the caller (which owns useDrillScoring/useComboTracker) for that drill's
// final result, so the score/combo captured is the freshest possible.
type GetDrillResult = (drill: TrainingDrill) => Omit<CompletedDrillResult, 'drillId' | 'moveId'>;

const COUNTDOWN_SECS = 3;
const DRILL_COMPLETE_SECS = 2;

export function usePlanSession(
  drills: TrainingDrill[],
  dayNumber: number,
  getDrillResult?: GetDrillResult,
): PlanSessionState {
  const markPlanDayComplete = useAppStore(s => s.markPlanDayComplete);
  const activePlan = useAppStore(s => s.activePlan);

  const [phase, setPhase] = useState<SessionPhase>('idle');
  const [currentDrillIndex, setCurrentDrillIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(COUNTDOWN_SECS);
  const [completedDrills, setCompletedDrills] = useState<string[]>([]);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [sessionStatsId, setSessionStatsId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [lastDrillResult, setLastDrillResult] = useState<CompletedDrillResult | null>(null);
  const [drillAttemptId, setDrillAttemptId] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tipTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef<string[]>([]);
  const isPausedRef = useRef(false);
  const currentDrillIndexRef = useRef(0);
  const drillResultsRef = useRef<CompletedDrillResult[]>([]);
  const getDrillResultRef = useRef<GetDrillResult | undefined>(getDrillResult);

  useEffect(() => {
    getDrillResultRef.current = getDrillResult;
  }, [getDrillResult]);

  useEffect(() => {
    completedRef.current = completedDrills;
  }, [completedDrills]);

  useEffect(() => {
    currentDrillIndexRef.current = currentDrillIndex;
  }, [currentDrillIndex]);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (tipTimerRef.current) clearInterval(tipTimerRef.current);
    timerRef.current = null;
    tipTimerRef.current = null;
  }, []);

  const buildStats = useCallback(
    (completed: string[]): CompletedPlanSession => {
      const completedDrillObjects = drills.filter(d => completed.includes(d.id));
      const totalActiveSecs = completedDrillObjects.reduce((a, d) => a + d.durationSeconds, 0);
      const totalBreakSecs = completedDrillObjects
        .slice(0, -1)
        .reduce((a, d) => a + d.breakSeconds, 0);

      return {
        id: generateId(),
        planId: activePlan?.id ?? '',
        dayNumber,
        drillsCompleted: completed.length,
        drillsTotal: drills.length,
        completedDrillNames: completedDrillObjects.map(d => d.name),
        totalActiveSecs,
        totalBreakSecs,
        completionRate: drills.length > 0 ? Math.round((completed.length / drills.length) * 100) : 0,
        completedAt: Date.now(),
        drillResults: drillResultsRef.current.filter(r => completed.includes(r.drillId)),
      };
    },
    [drills, activePlan, dayNumber],
  );

  const enterComplete = useCallback(
    (completed: string[]) => {
      clearTimers();
      const stats = buildStats(completed);
      trainingPlanRepository.markDayComplete(dayNumber, stats);
      markPlanDayComplete(dayNumber);
      setSessionStatsId(stats.id);
      setPhase('complete');
    },
    [clearTimers, buildStats, dayNumber, markPlanDayComplete],
  );

  // Forward declaration ref so startDrill can call itself recursively via ref
  const startDrillRef = useRef<(index: number, currentCompleted: string[]) => void>(() => {});

  const startDrill = useCallback(
    (index: number, currentCompleted: string[]) => {
      if (index >= drills.length) {
        enterComplete(currentCompleted);
        return;
      }

      const drill = drills[index];
      setCurrentDrillIndex(index);
      setTimeRemaining(drill.durationSeconds);
      setCurrentTipIndex(0);
      setPhase('drill');
      setDrillAttemptId(id => id + 1);

      // Tip rotation every 10s — fallback content for drills without real-time
      // AI/correction feedback (see useDrillScoring's scoreMode).
      if (tipTimerRef.current) clearInterval(tipTimerRef.current);
      tipTimerRef.current = setInterval(() => {
        if (isPausedRef.current) return;
        setCurrentTipIndex(prev => (prev + 1) % (drill.coachingTips.length || 1));
      }, 10000);

      // Drill timer — uses tick counter so transition happens outside a functional updater
      let drillTicks = 0;
      timerRef.current = setInterval(() => {
        if (isPausedRef.current) return;
        drillTicks += 1;

        if (drillTicks >= drill.durationSeconds) {
          clearInterval(timerRef.current!);
          timerRef.current = null;

          const nowCompleted = [...completedRef.current, drill.id];
          setCompletedDrills(nowCompleted);
          completedRef.current = nowCompleted;

          const partial = getDrillResultRef.current?.(drill) ?? {
            scoreMode: 'heuristic' as const,
            avgScore: null,
            bestCombo: 0,
            isNewBest: false,
          };
          const result: CompletedDrillResult = { drillId: drill.id, moveId: drill.moveId, ...partial };
          drillResultsRef.current = [...drillResultsRef.current, result];
          setLastDrillResult(result);

          // Brief celebratory beat before moving to break/completion.
          setPhase('drillComplete');
          let completeTicks = 0;
          timerRef.current = setInterval(() => {
            if (isPausedRef.current) return;
            completeTicks += 1;
            if (completeTicks < DRILL_COMPLETE_SECS) return;
            clearInterval(timerRef.current!);
            timerRef.current = null;

            if (index + 1 >= drills.length) {
              enterComplete(nowCompleted);
              return;
            }

            // Start break
            setCurrentDrillIndex(index + 1);
            setTimeRemaining(drill.breakSeconds);
            setPhase('break');

            let breakTicks = 0;
            timerRef.current = setInterval(() => {
              if (isPausedRef.current) return;
              breakTicks += 1;

              if (breakTicks >= drill.breakSeconds) {
                clearInterval(timerRef.current!);
                timerRef.current = null;
                startDrillRef.current(index + 1, nowCompleted);
                return;
              }

              setTimeRemaining(prev => Math.max(0, prev - 1));
            }, 1000);
          }, 1000);
          return;
        }

        setTimeRemaining(prev => Math.max(0, prev - 1));
      }, 1000);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drills, enterComplete],
  );

  // Keep the ref current so the break timer's recursive call always uses the latest startDrill
  useEffect(() => {
    startDrillRef.current = startDrill;
  }, [startDrill]);

  const start = useCallback(() => {
    if (drills.length === 0) return;
    clearTimers();
    isPausedRef.current = false;
    setIsPaused(false);
    setCompletedDrills([]);
    completedRef.current = [];
    drillResultsRef.current = [];
    setLastDrillResult(null);
    setCurrentDrillIndex(0);
    setTimeRemaining(COUNTDOWN_SECS);
    setPhase('countdown');

    // Countdown timer — tick counter so startDrill is NOT called inside a functional updater
    let countdownTicks = 0;
    timerRef.current = setInterval(() => {
      if (isPausedRef.current) return;
      countdownTicks += 1;

      if (countdownTicks >= COUNTDOWN_SECS) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        startDrill(0, []);
        return;
      }

      setTimeRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
  }, [drills, clearTimers, startDrill]);

  const pause = useCallback(() => {
    isPausedRef.current = true;
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    isPausedRef.current = false;
    setIsPaused(false);
  }, []);

  const restartDrill = useCallback(() => {
    const index = currentDrillIndexRef.current;
    const drill = drills[index];
    if (!drill) return;

    if (tipTimerRef.current) clearInterval(tipTimerRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    tipTimerRef.current = null;
    timerRef.current = null;

    const filtered = completedRef.current.filter(id => id !== drill.id);
    setCompletedDrills(filtered);
    completedRef.current = filtered;
    drillResultsRef.current = drillResultsRef.current.filter(r => r.drillId !== drill.id);
    setLastDrillResult(null);

    startDrill(index, filtered);
  }, [drills, startDrill]);

  const abort = useCallback((): CompletedPlanSession | null => {
    clearTimers();
    const completed = completedRef.current;
    setPhase('idle');
    if (completed.length === 0) return null;
    return buildStats(completed);
  }, [clearTimers, buildStats]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const currentDrill = drills[currentDrillIndex] ?? null;

  return {
    phase,
    currentDrillIndex,
    timeRemaining,
    // Note: currentDrillIndex only advances when entering 'break', not
    // 'drillComplete' — during drillComplete it still points at the drill
    // that just finished, same as during 'drill'.
    currentDrill: phase === 'break' ? drills[currentDrillIndex - 1] ?? null : currentDrill,
    nextDrill: phase === 'break' ? currentDrill : drills[currentDrillIndex + 1] ?? null,
    completedDrills,
    currentTipIndex,
    sessionStatsId,
    isPaused,
    lastDrillResult,
    drillAttemptId,
    start,
    abort,
    pause,
    resume,
    restartDrill,
  };
}
