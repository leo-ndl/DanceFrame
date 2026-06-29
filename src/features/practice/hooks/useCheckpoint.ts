import { useEffect, useRef, useState } from 'react';
import { MetricsSnapshot } from './useMetrics';

export interface CheckpointData {
  strength: string;
  priority: string;
  encouragement: string;
}

const CHECKPOINT_INTERVAL_S = 45;
const DISPLAY_DURATION_MS = 3000;

const METRIC_LABELS: Record<keyof MetricsSnapshot, string> = {
  smoothness: 'Smoothness',
  balance: 'Balance',
  stability: 'Stability',
  symmetry: 'Symmetry',
  flow: 'Flow',
  rangeOfMotion: 'Range of Motion',
  control: 'Control',
};

const ENCOURAGEMENTS = [
  "Keep pushing — you're improving!",
  'Your body is learning. Stay consistent.',
  "Every rep counts. Don't stop now!",
  "Focus and flow. You've got this.",
  'Great effort — keep the energy up!',
];

export function useCheckpoint(
  elapsedSeconds: number,
  metrics: MetricsSnapshot,
  isActive: boolean,
): CheckpointData | null {
  const [data, setData] = useState<CheckpointData | null>(null);
  const lastCheckpointRef = useRef(0);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const encouragementIdxRef = useRef(0);
  // Ref keeps the latest metrics available to the effect without making
  // metrics a dependency (which would re-run the effect every 250 ms).
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;

  useEffect(() => {
    if (!isActive) {
      lastCheckpointRef.current = 0;
      setData(null);
      return;
    }

    const elapsed = elapsedSeconds;
    if (
      elapsed > 0 &&
      elapsed - lastCheckpointRef.current >= CHECKPOINT_INTERVAL_S
    ) {
      lastCheckpointRef.current = elapsed;

      // Find strongest and weakest metric using the latest snapshot via ref.
      const entries = Object.entries(metricsRef.current) as [keyof MetricsSnapshot, number][];
      const sorted = entries.sort((a, b) => b[1] - a[1]);
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];

      const encouragement =
        ENCOURAGEMENTS[encouragementIdxRef.current % ENCOURAGEMENTS.length];
      encouragementIdxRef.current += 1;

      setData({
        strength: best ? METRIC_LABELS[best[0]] : 'Movement',
        priority: worst ? METRIC_LABELS[worst[0]] : 'Control',
        encouragement,
      });

      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = setTimeout(() => setData(null), DISPLAY_DURATION_MS);
    }
  }, [elapsedSeconds, isActive]);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  return data;
}
