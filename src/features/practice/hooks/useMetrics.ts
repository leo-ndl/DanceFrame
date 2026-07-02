import { useEffect, useRef, useState } from 'react';
import { PoseFrameResult } from '@/core/ai/types/ml.types';
import { computeFromBuffer, clamp01 } from '@/shared/utils/poseMetrics';
import { ComparisonResult } from '../types/pose.types';

export interface MetricsSnapshot {
  smoothness: number;
  balance: number;
  stability: number;
  symmetry: number;
  flow: number;
  rangeOfMotion: number;
  control: number;
}

const EMPTY: MetricsSnapshot = {
  smoothness: 0,
  balance: 0,
  stability: 0,
  symmetry: 0,
  flow: 0,
  rangeOfMotion: 0,
  control: 0,
};

export function useMetrics(
  lastComparison: ComparisonResult | null,
  poseBuffer: PoseFrameResult[],
): MetricsSnapshot {
  const [metrics, setMetrics] = useState<MetricsSnapshot>(EMPTY);

  // Refs keep the interval closure fresh without being effect deps.
  // Both inputs change too frequently to be safe deps:
  //   poseBuffer — new array reference on every pose frame (~30 fps)
  //   lastComparison — flushed to state every 250 ms in usePracticeSession
  const lastComparisonRef = useRef(lastComparison);
  const poseBufferRef = useRef(poseBuffer);
  lastComparisonRef.current = lastComparison;
  poseBufferRef.current = poseBuffer;

  useEffect(() => {
    const id = setInterval(() => {
      const lc = lastComparisonRef.current;
      const bufferDerived = computeFromBuffer(poseBufferRef.current);
      setMetrics({
        control: lc ? clamp01(lc.precisionScore / 100) : 0,
        flow: lc ? clamp01(lc.timingScore / 100) : 0,
        stability: lc ? clamp01(lc.isolationScore / 100) : bufferDerived.stability,
        smoothness: bufferDerived.smoothness,
        balance: bufferDerived.balance,
        symmetry: bufferDerived.symmetry,
        rangeOfMotion: bufferDerived.rangeOfMotion,
      });
    }, 250);
    return () => clearInterval(id);
  }, []); // runs once — inputs are read via refs

  return metrics;
}
