import { useEffect, useRef, useState } from 'react';
import { PoseFrameResult } from '@/core/ai/types/ml.types';
import { PoseStreamFrame } from '@/features/import/types/motion.types';
import { normalizeFrame } from '@/features/import/services/PoseNormalizer';
import { movementComparison } from '../services/movementComparison';
import { ComparisonResult } from '../types/pose.types';

export type CoachingEvent =
  | { type: 'improvement'; deltaScore: number }
  | { type: 'repeatedMistake'; bodyPart: string }
  | { type: 'syncLoss'; durationMs: number }
  | { type: 'recovery' }
  | { type: 'exceptionalExecution'; score: number };

export interface RollingAnalysisOutput {
  windowMeanScore: number;
  syncConfidence: number;
  dominantError: string | null;
  event: CoachingEvent | null;
  windowSize: number;
}

const DEFAULT_OUTPUT: RollingAnalysisOutput = {
  windowMeanScore: 0,
  syncConfidence: 0,
  dominantError: null,
  event: null,
  windowSize: 0,
};

const FLUSH_INTERVAL_MS = 300;
const SYNC_THRESHOLD_HIGH = 55;
const SYNC_EMA_ALPHA = 0.3;
const SYNC_LOSS_THRESHOLD = 0.35;
const SYNC_LOSS_MIN_MS = 3000;
const SYNC_RECOVERY_THRESHOLD = 0.55;
const IMPROVEMENT_DELTA = 8;
const EXCEPTIONAL_SCORE = 88;
const REPEATED_MISTAKE_RATIO = 0.6;
const REPEATED_MISTAKE_WINDOWS = 2;

interface BufferEntry {
  result: ComparisonResult;
  capturedAt: number;
}

function binarySearchBracket(
  stream: PoseStreamFrame[],
  targetMs: number,
): [number, number] {
  let lo = 0;
  let hi = stream.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >>> 1;
    if ((stream[mid]?.timestamp ?? 0) <= targetMs) lo = mid;
    else hi = mid;
  }
  return [lo, hi];
}

function getReferenceFrame(
  stream: PoseStreamFrame[],
  progress: number,
): PoseStreamFrame | null {
  if (stream.length === 0) return null;
  if (stream.length === 1) return stream[0] ?? null;
  const first = stream[0];
  const last = stream[stream.length - 1];
  if (!first || !last) return null;
  const dur = last.timestamp - first.timestamp;
  if (dur <= 0) return first;
  const targetMs = first.timestamp + progress * dur;
  const [lo, hi] = binarySearchBracket(stream, targetMs);
  const frameA = stream[lo];
  const frameB = stream[hi];
  const span = (frameB?.timestamp ?? 0) - (frameA?.timestamp ?? 0);
  const t = span > 0 ? (targetMs - (frameA?.timestamp ?? 0)) / span : 0;
  // Return the closer frame (no interpolation needed for comparison)
  return (t < 0.5 ? frameA : frameB) ?? null;
}

function dominantErrorFromWindow(entries: BufferEntry[]): string | null {
  const counts: Record<string, number> = {};
  for (const e of entries) {
    for (const err of e.result.errors) {
      counts[err] = (counts[err] ?? 0) + 1;
    }
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [err, count] of Object.entries(counts)) {
    if (count > bestCount) { best = err; bestCount = count; }
  }
  return best;
}

export function useRollingAnalysis(
  referenceStream: PoseStreamFrame[],
  mascotProgress: number,
  currentPose: PoseFrameResult | null,
  isActive: boolean,
  windowDurationMs = 2500,
): RollingAnalysisOutput {
  const [output, setOutput] = useState<RollingAnalysisOutput>(DEFAULT_OUTPUT);

  // Ring buffer — written at ~30fps, never triggers a render directly
  const bufferRef = useRef<BufferEntry[]>([]);

  // Event state refs (no setState to avoid extra renders)
  const prevWindowMeanRef = useRef<number>(0);
  const smoothSyncRef = useRef<number>(0);
  const syncLossStartRef = useRef<number | null>(null);
  const inSyncLossRef = useRef(false);
  const repeatedMistakeWindowsRef = useRef(0);
  const prevDominantErrorRef = useRef<string | null>(null);
  const mascotProgressRef = useRef(mascotProgress);
  mascotProgressRef.current = mascotProgress;

  // Per-pose capture — runs at frame rate, writes to ref only
  useEffect(() => {
    if (!isActive || !currentPose || referenceStream.length < 2) return;
    const refFrame = getReferenceFrame(referenceStream, mascotProgressRef.current);
    if (!refFrame) return;
    const normalizedUser = normalizeFrame(currentPose);
    const refPose: PoseFrameResult = {
      keypoints: refFrame.keypoints,
      timestamp: refFrame.timestamp,
      confidence: refFrame.confidence,
    };
    const result = movementComparison.compare(normalizedUser, refPose);
    bufferRef.current.push({ result, capturedAt: Date.now() });
  }, [currentPose, isActive, referenceStream]);

  // 300ms flush — computes window stats and fires a single setState
  useEffect(() => {
    if (!isActive) return;

    const id = setInterval(() => {
      const now = Date.now();
      const cutoff = now - windowDurationMs;
      // Trim old entries
      bufferRef.current = bufferRef.current.filter(e => e.capturedAt >= cutoff);
      const window = bufferRef.current;
      const windowSize = window.length;

      if (windowSize === 0) {
        setOutput(prev => ({ ...prev, event: null, windowSize: 0 }));
        return;
      }

      // Window mean score
      const windowMean = window.reduce((s, e) => s + e.result.overallScore, 0) / windowSize;

      // Sync confidence: fraction scoring above threshold, EMA-smoothed
      const aboveThreshold = window.filter(e => e.result.overallScore > SYNC_THRESHOLD_HIGH).length;
      const rawSync = aboveThreshold / windowSize;
      smoothSyncRef.current =
        SYNC_EMA_ALPHA * rawSync + (1 - SYNC_EMA_ALPHA) * smoothSyncRef.current;
      const syncConfidence = smoothSyncRef.current;

      // Dominant error
      const dominantError = dominantErrorFromWindow(window);

      // Event detection
      let event: CoachingEvent | null = null;
      const prev = prevWindowMeanRef.current;

      if (windowSize >= 5) {
        // Exceptional execution
        if (windowMean > EXCEPTIONAL_SCORE) {
          event = { type: 'exceptionalExecution', score: windowMean };
        }
        // Improvement
        else if (prev > 0 && windowMean - prev >= IMPROVEMENT_DELTA) {
          event = { type: 'improvement', deltaScore: windowMean - prev };
        }
        // Sync loss / recovery
        else if (syncConfidence < SYNC_LOSS_THRESHOLD) {
          if (!inSyncLossRef.current) {
            syncLossStartRef.current = now;
            inSyncLossRef.current = true;
          } else if (
            syncLossStartRef.current !== null &&
            now - syncLossStartRef.current >= SYNC_LOSS_MIN_MS
          ) {
            event = { type: 'syncLoss', durationMs: now - syncLossStartRef.current };
            // Don't fire again until recovery
            syncLossStartRef.current = now + SYNC_LOSS_MIN_MS * 2;
          }
        } else if (inSyncLossRef.current && syncConfidence >= SYNC_RECOVERY_THRESHOLD) {
          inSyncLossRef.current = false;
          syncLossStartRef.current = null;
          event = { type: 'recovery' };
        }

        // Repeated mistake (dominant error unchanged for N consecutive windows)
        if (!event && dominantError) {
          if (dominantError === prevDominantErrorRef.current) {
            repeatedMistakeWindowsRef.current += 1;
            const dominantCount = window.filter(
              e => e.result.errors.includes(dominantError),
            ).length;
            if (
              repeatedMistakeWindowsRef.current >= REPEATED_MISTAKE_WINDOWS &&
              dominantCount / windowSize >= REPEATED_MISTAKE_RATIO
            ) {
              event = { type: 'repeatedMistake', bodyPart: dominantError };
              repeatedMistakeWindowsRef.current = 0;
            }
          } else {
            repeatedMistakeWindowsRef.current = 0;
          }
        }
      }

      prevWindowMeanRef.current = windowMean;
      prevDominantErrorRef.current = dominantError;

      setOutput({ windowMeanScore: windowMean, syncConfidence, dominantError, event, windowSize });
    }, FLUSH_INTERVAL_MS);

    return () => clearInterval(id);
  }, [isActive, windowDurationMs]);

  // Reset when session becomes inactive
  useEffect(() => {
    if (!isActive) {
      bufferRef.current = [];
      prevWindowMeanRef.current = 0;
      smoothSyncRef.current = 0;
      syncLossStartRef.current = null;
      inSyncLossRef.current = false;
      repeatedMistakeWindowsRef.current = 0;
      prevDominantErrorRef.current = null;
      setOutput(DEFAULT_OUTPUT);
    }
  }, [isActive]);

  return output;
}
