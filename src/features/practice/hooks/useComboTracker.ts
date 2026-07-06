import { useCallback, useEffect, useRef, useState } from 'react';

export interface ComboState {
  combo: number;
  hitCount: number;
  bestComboThisSession: number;
  lastMilestone: number | null;
  justHit: boolean;
}

export interface ComboTrackerOptions {
  hitThreshold?: number;
  milestones?: number[];
}

export interface ComboTracker extends ComboState {
  /** Feed one frame's score in. Call this per-frame from the scoring loop
   * (mirrors the previous inline comboRef pattern in usePracticeSession).
   * Returns the resulting combo count synchronously so callers can react
   * immediately (e.g. milestone toasts) without waiting for a re-render. */
  registerScore: (score: number) => number;
  reset: () => void;
}

const DEFAULT_THRESHOLD = 70;
const DEFAULT_MILESTONES = [5, 10, 20, 50];
const JUST_HIT_PULSE_MS = 200;

/**
 * Shared hit/combo/milestone tracker used by both the single-move Practice
 * flow and the training-drill flow, so combo semantics (threshold, escalating
 * milestones) live in one place instead of being duplicated per feature.
 */
export function useComboTracker(isActive: boolean, options?: ComboTrackerOptions): ComboTracker {
  const threshold = options?.hitThreshold ?? DEFAULT_THRESHOLD;
  const milestones = options?.milestones ?? DEFAULT_MILESTONES;

  const [combo, setCombo] = useState(0);
  const [hitCount, setHitCount] = useState(0);
  const [bestComboThisSession, setBestComboThisSession] = useState(0);
  const [lastMilestone, setLastMilestone] = useState<number | null>(null);
  const [justHit, setJustHit] = useState(false);

  const comboRef = useRef(0);
  const hitCountRef = useRef(0);
  const bestComboRef = useRef(0);
  const justHitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    comboRef.current = 0;
    hitCountRef.current = 0;
    bestComboRef.current = 0;
    setCombo(0);
    setHitCount(0);
    setBestComboThisSession(0);
    setLastMilestone(null);
    setJustHit(false);
  }, []);

  useEffect(() => {
    if (!isActive) reset();
  }, [isActive, reset]);

  const registerScore = useCallback(
    (score: number): number => {
      if (score >= threshold) {
        comboRef.current += 1;
        hitCountRef.current += 1;
        bestComboRef.current = Math.max(bestComboRef.current, comboRef.current);
        setHitCount(hitCountRef.current);
        setBestComboThisSession(bestComboRef.current);

        setJustHit(true);
        if (justHitTimerRef.current) clearTimeout(justHitTimerRef.current);
        justHitTimerRef.current = setTimeout(() => setJustHit(false), JUST_HIT_PULSE_MS);

        if (milestones.includes(comboRef.current)) {
          setLastMilestone(comboRef.current);
        }
      } else {
        comboRef.current = 0;
      }
      setCombo(comboRef.current);
      return comboRef.current;
    },
    [threshold, milestones],
  );

  useEffect(() => {
    return () => {
      if (justHitTimerRef.current) clearTimeout(justHitTimerRef.current);
    };
  }, []);

  return { combo, hitCount, bestComboThisSession, lastMilestone, justHit, registerScore, reset };
}
