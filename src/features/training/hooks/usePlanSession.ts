import { useCallback, useEffect, useRef, useState } from 'react';
import { trainingPlanRepository } from '@/core/data/repositories/TrainingPlanRepository';
import { useAppStore } from '@/core/state/store';
import { CompletedPlanSession, SessionPhase, TrainingDrill } from '../types/training.types';
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
  start: () => void;
  abort: () => CompletedPlanSession | null;
}

const COUNTDOWN_SECS = 3;

export function usePlanSession(drills: TrainingDrill[], dayNumber: number): PlanSessionState {
  const markPlanDayComplete = useAppStore(s => s.markPlanDayComplete);
  const activePlan = useAppStore(s => s.activePlan);

  const [phase, setPhase] = useState<SessionPhase>('idle');
  const [currentDrillIndex, setCurrentDrillIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(COUNTDOWN_SECS);
  const [completedDrills, setCompletedDrills] = useState<string[]>([]);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [sessionStatsId, setSessionStatsId] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tipTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const completedRef = useRef<string[]>([]);

  // Keep ref in sync for use inside intervals
  useEffect(() => {
    completedRef.current = completedDrills;
  }, [completedDrills]);

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
      };
    },
    [drills, activePlan, dayNumber],
  );

  const enterComplete = useCallback(
    (completed: string[]) => {
      clearTimers();
      const stats = buildStats(completed);
      const statsId = stats.id;

      trainingPlanRepository.markDayComplete(dayNumber, stats);
      markPlanDayComplete(dayNumber);

      setSessionStatsId(statsId);
      setPhase('complete');
    },
    [clearTimers, buildStats, dayNumber, markPlanDayComplete],
  );

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

      // Tip rotation every 10s
      if (tipTimerRef.current) clearInterval(tipTimerRef.current);
      tipTimerRef.current = setInterval(() => {
        setCurrentTipIndex(prev => (prev + 1) % (drill.coachingTips.length || 1));
      }, 10000);

      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            timerRef.current = null;

            const nowCompleted = [...completedRef.current, drill.id];
            setCompletedDrills(nowCompleted);
            completedRef.current = nowCompleted;

            if (index + 1 >= drills.length) {
              enterComplete(nowCompleted);
            } else {
              // Enter break
              const nextDrill = drills[index + 1];
              setCurrentDrillIndex(index + 1);
              setTimeRemaining(drill.breakSeconds);
              setPhase('break');

              timerRef.current = setInterval(() => {
                setTimeRemaining(p => {
                  if (p <= 1) {
                    clearInterval(timerRef.current!);
                    timerRef.current = null;
                    startDrill(index + 1, nowCompleted);
                    return 0;
                  }
                  return p - 1;
                });
              }, 1000);
              return drill.breakSeconds;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drills, enterComplete],
  );

  const start = useCallback(() => {
    if (drills.length === 0) return;
    clearTimers();
    setCompletedDrills([]);
    completedRef.current = [];
    setCurrentDrillIndex(0);
    setTimeRemaining(COUNTDOWN_SECS);
    startTimeRef.current = Date.now();
    setPhase('countdown');

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          startDrill(0, []);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [drills, clearTimers, startDrill]);

  const abort = useCallback((): CompletedPlanSession | null => {
    clearTimers();
    const completed = completedRef.current;
    setPhase('idle');
    if (completed.length === 0) return null;
    return buildStats(completed);
  }, [clearTimers, buildStats]);

  // Cleanup on unmount
  useEffect(() => () => clearTimers(), [clearTimers]);

  const currentDrill = drills[currentDrillIndex] ?? null;
  const nextDrill =
    phase === 'break' ? drills[currentDrillIndex] ?? null : drills[currentDrillIndex + 1] ?? null;

  return {
    phase,
    currentDrillIndex,
    timeRemaining,
    currentDrill: phase === 'break' ? drills[currentDrillIndex - 1] ?? null : currentDrill,
    nextDrill: phase === 'break' ? currentDrill : nextDrill,
    completedDrills,
    currentTipIndex,
    sessionStatsId,
    start,
    abort,
  };
}
