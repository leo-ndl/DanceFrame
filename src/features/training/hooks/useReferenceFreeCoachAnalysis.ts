import { useEffect, useRef, useState } from 'react';
import { PoseFrameResult } from '@/core/ai/types/ml.types';
import {
  BodyRegion,
  computeActiveRegions,
  computeFromBuffer,
  computeRhythmConsistency,
} from '@/shared/utils/poseMetrics';

export interface MotionWindowSummary {
  rhythm: number;
  balance: number;
  smoothness: number;
  amplitude: number;
  movementSpeed: number;
  activeRegions: BodyRegion[];
  trend: 'improving' | 'stable' | 'declining';
  windowSize: number;
}

export type ReferenceFreeEvent =
  | { type: 'reducedAmplitude' }
  | { type: 'rhythmLoss' }
  | { type: 'rhythmRecovery' }
  | { type: 'significantImprovement'; delta: number }
  | { type: 'excellentExecution' };

export interface ReferenceFreeOutput {
  summary: MotionWindowSummary;
  event: ReferenceFreeEvent | null;
}

const DEFAULT_SUMMARY: MotionWindowSummary = {
  rhythm: 0,
  balance: 0,
  smoothness: 0,
  amplitude: 0,
  movementSpeed: 0,
  activeRegions: [],
  trend: 'stable',
  windowSize: 0,
};

const ANALYSIS_INTERVAL_MS = 80; // ~12.5Hz, within FR-1's recommended 10-15/sec
const MIN_WINDOW_FOR_EVENTS = 6;

const AMPLITUDE_LOW_THRESHOLD = 0.25;
const AMPLITUDE_LOW_MIN_WINDOWS = 2;
const RHYTHM_LOSS_THRESHOLD = 0.4;
const RHYTHM_RECOVERY_THRESHOLD = 0.6;
const IMPROVEMENT_DELTA = 0.15;
const EXCELLENT_THRESHOLD = 0.85;
const TREND_DELTA = 0.08;

interface BufferEntry {
  pose: PoseFrameResult;
  capturedAt: number;
}

function composite(rhythm: number, smoothness: number, balance: number): number {
  return 0.4 * rhythm + 0.3 * smoothness + 0.3 * balance;
}

/**
 * Reference-free counterpart to useRollingAnalysis — runs off the dancer's
 * own pose buffer alone (no reference/comparison stream), so it covers
 * heuristic-mode drills that useRollingAnalysis never analyzes at all.
 * Mirrors its ring-buffer + interval-flush + hysteresis pattern.
 */
export function useReferenceFreeCoachAnalysis(
  currentPose: PoseFrameResult | null,
  isActive: boolean,
  windowDurationMs = 4000,
): ReferenceFreeOutput {
  const [output, setOutput] = useState<ReferenceFreeOutput>({ summary: DEFAULT_SUMMARY, event: null });

  const bufferRef = useRef<BufferEntry[]>([]);
  const prevCompositeRef = useRef<number>(0);
  const inAmplitudeLossRef = useRef(0);
  const inRhythmLossRef = useRef(false);

  useEffect(() => {
    if (!isActive || !currentPose) return;
    bufferRef.current = [...bufferRef.current, { pose: currentPose, capturedAt: Date.now() }];
  }, [currentPose, isActive]);

  useEffect(() => {
    if (!isActive) return;

    const id = setInterval(() => {
      const now = Date.now();
      const cutoff = now - windowDurationMs;
      bufferRef.current = bufferRef.current.filter(e => e.capturedAt >= cutoff);
      const window = bufferRef.current.map(e => e.pose);
      const windowSize = window.length;

      if (windowSize === 0) {
        setOutput(prev => ({ ...prev, event: null }));
        return;
      }

      const derived = computeFromBuffer(window);
      const rhythm = computeRhythmConsistency(window);
      const activeRegions = computeActiveRegions(window);
      const score = composite(rhythm, derived.smoothness, derived.balance);

      let trend: MotionWindowSummary['trend'] = 'stable';
      if (prevCompositeRef.current > 0) {
        const delta = score - prevCompositeRef.current;
        if (delta > TREND_DELTA) trend = 'improving';
        else if (delta < -TREND_DELTA) trend = 'declining';
      }

      const summary: MotionWindowSummary = {
        rhythm,
        balance: derived.balance,
        smoothness: derived.smoothness,
        amplitude: derived.rangeOfMotion,
        movementSpeed: derived.movementSpeed,
        activeRegions,
        trend,
        windowSize,
      };

      let event: ReferenceFreeEvent | null = null;

      if (windowSize >= MIN_WINDOW_FOR_EVENTS) {
        if (score > EXCELLENT_THRESHOLD) {
          event = { type: 'excellentExecution' };
        } else if (prevCompositeRef.current > 0 && score - prevCompositeRef.current >= IMPROVEMENT_DELTA) {
          event = { type: 'significantImprovement', delta: score - prevCompositeRef.current };
        } else if (rhythm < RHYTHM_LOSS_THRESHOLD) {
          if (!inRhythmLossRef.current) {
            inRhythmLossRef.current = true;
            event = { type: 'rhythmLoss' };
          }
        } else if (inRhythmLossRef.current && rhythm >= RHYTHM_RECOVERY_THRESHOLD) {
          inRhythmLossRef.current = false;
          event = { type: 'rhythmRecovery' };
        }

        if (!event) {
          if (derived.rangeOfMotion < AMPLITUDE_LOW_THRESHOLD) {
            inAmplitudeLossRef.current += 1;
            if (inAmplitudeLossRef.current >= AMPLITUDE_LOW_MIN_WINDOWS) {
              event = { type: 'reducedAmplitude' };
              inAmplitudeLossRef.current = 0;
            }
          } else {
            inAmplitudeLossRef.current = 0;
          }
        }
      }

      prevCompositeRef.current = score;
      setOutput({ summary, event });
    }, ANALYSIS_INTERVAL_MS);

    return () => clearInterval(id);
  }, [isActive, windowDurationMs]);

  useEffect(() => {
    if (!isActive) {
      bufferRef.current = [];
      prevCompositeRef.current = 0;
      inAmplitudeLossRef.current = 0;
      inRhythmLossRef.current = false;
      setOutput({ summary: DEFAULT_SUMMARY, event: null });
    }
  }, [isActive]);

  return output;
}
