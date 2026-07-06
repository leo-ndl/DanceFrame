import { useState, useEffect, useRef, useCallback } from 'react';
import { PoseFrameResult, PoseKeypoint } from '@/core/ai/types/ml.types';
import { PoseStreamFrame } from '@/features/moves/types/motion.types';

export type PlaybackSpeed = 0.25 | 0.5 | 1 | 1.5 | 2;

interface PlaybackOptions {
  speed?: PlaybackSpeed;
  loop?: boolean;
  /** Called every animation tick with the current 0–1 progress. Batched with
   *  the internal setState calls so it does NOT trigger a second render. */
  onProgress?: (progress: number) => void;
}

interface MascotPlaybackResult {
  pose: PoseFrameResult | null;
  isPlaying: boolean;
  /** 0–1 progress through the stream. */
  progress: number;
  play: () => void;
  pause: () => void;
  seek: (ms: number) => void;
}

function binarySearchBracket(
  stream: PoseStreamFrame[],
  targetMs: number,
): [number, number] {
  let lo = 0;
  let hi = stream.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >>> 1;
    if ((stream[mid]?.timestamp ?? 0) <= targetMs) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return [lo, hi];
}

function interpolatePose(
  a: PoseStreamFrame,
  b: PoseStreamFrame,
  t: number,
): PoseFrameResult {
  const kpCount = Math.min(a.keypoints.length, b.keypoints.length);
  const keypoints: PoseKeypoint[] = [];
  for (let i = 0; i < kpCount; i++) {
    const ka = a.keypoints[i];
    const kb = b.keypoints[i];
    if (!ka || !kb) continue;
    keypoints.push({
      name: ka.name,
      x: ka.x + (kb.x - ka.x) * t,
      y: ka.y + (kb.y - ka.y) * t,
      confidence: t < 0.5 ? ka.confidence : kb.confidence,
    });
  }
  return {
    keypoints,
    timestamp: a.timestamp + (b.timestamp - a.timestamp) * t,
    confidence: a.confidence + (b.confidence - a.confidence) * t,
  };
}

function poseFromStream(
  stream: PoseStreamFrame[],
  currentMs: number,
): PoseFrameResult | null {
  if (stream.length === 0) return null;
  if (stream.length === 1) {
    const f = stream[0];
    return { keypoints: f.keypoints, timestamp: f.timestamp, confidence: f.confidence };
  }
  const first = stream[0];
  const last = stream[stream.length - 1];
  if (currentMs <= (first?.timestamp ?? 0)) {
    return { keypoints: first.keypoints, timestamp: first.timestamp, confidence: first.confidence };
  }
  if (currentMs >= (last?.timestamp ?? 0)) {
    return { keypoints: last.keypoints, timestamp: last.timestamp, confidence: last.confidence };
  }
  const [lo, hi] = binarySearchBracket(stream, currentMs);
  const frameA = stream[lo];
  const frameB = stream[hi];
  if (!frameA || !frameB) return null;
  const span = frameB.timestamp - frameA.timestamp;
  const t = span > 0 ? (currentMs - frameA.timestamp) / span : 0;
  return interpolatePose(frameA, frameB, t);
}

export function useMascotPlayback(
  stream: PoseStreamFrame[],
  opts: PlaybackOptions = {},
): MascotPlaybackResult {
  const { speed = 1, loop = true, onProgress } = opts;

  const firstFrame = stream[0];
  const [pose, setPose] = useState<PoseFrameResult | null>(
    firstFrame
      ? { keypoints: firstFrame.keypoints, timestamp: firstFrame.timestamp, confidence: firstFrame.confidence }
      : null,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const rafRef = useRef<number | undefined>(undefined);
  const lastWallRef = useRef<number>(0);
  const streamMsRef = useRef<number>(0);

  // Sync mutable inputs to refs every render so the RAF closure is never stale.
  // Computed synchronously (not in a useEffect) to guarantee the value is
  // available before the first tick fires.
  const streamRef = useRef(stream);
  const speedRef = useRef(speed);
  const loopRef = useRef(loop);
  const onProgressRef = useRef(onProgress);
  const durationMsRef = useRef(0);
  streamRef.current = stream;
  speedRef.current = speed;
  loopRef.current = loop;
  onProgressRef.current = onProgress;
  durationMsRef.current =
    stream.length > 1
      ? (stream[stream.length - 1]?.timestamp ?? 0) - (stream[0]?.timestamp ?? 0)
      : 0;

  const play = useCallback(() => {
    if (isPlaying) return;
    lastWallRef.current = Date.now();
    setIsPlaying(true);
  }, [isPlaying]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const seek = useCallback((ms: number) => {
    const s = streamRef.current;
    const dur = durationMsRef.current;
    streamMsRef.current = Math.max(0, Math.min(ms, dur));
    setPose(poseFromStream(s, (s[0]?.timestamp ?? 0) + streamMsRef.current));
    setProgress(dur > 0 ? streamMsRef.current / dur : 0);
  }, []);

  // The animation loop lives entirely inside this effect closure. doTick
  // reads all mutable values from refs so it never needs to be recreated.
  // The only dep is isPlaying — the loop starts/stops when that changes.
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== undefined) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = undefined;
      }
      return;
    }

    lastWallRef.current = Date.now();

    function doTick() {
      const now = Date.now();
      const wallDelta = now - lastWallRef.current;
      lastWallRef.current = now;

      const dur = durationMsRef.current;
      streamMsRef.current += wallDelta * speedRef.current;

      if (dur > 0 && streamMsRef.current > dur) {
        if (loopRef.current) {
          streamMsRef.current = streamMsRef.current % dur;
        } else {
          streamMsRef.current = dur;
          setIsPlaying(false);
          const s = streamRef.current;
          setPose(poseFromStream(s, dur + (s[0]?.timestamp ?? 0)));
          setProgress(1);
          return; // effect cleanup (triggered by isPlaying→false) will cancel RAF
        }
      }

      const s = streamRef.current;
      const currentProgress = dur > 0 ? streamMsRef.current / dur : 0;
      // Call onProgress in the same synchronous batch as setProgress/setPose so
      // React batches all three into one render instead of chaining a cascade.
      onProgressRef.current?.(currentProgress);
      setProgress(currentProgress);
      setPose(poseFromStream(s, (s[0]?.timestamp ?? 0) + streamMsRef.current));

      rafRef.current = requestAnimationFrame(doTick);
    }

    rafRef.current = requestAnimationFrame(doTick);

    return () => {
      if (rafRef.current !== undefined) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = undefined;
      }
    };
  }, [isPlaying]);

  // Reset playhead when the stream identity genuinely changes.
  useEffect(() => {
    streamMsRef.current = 0;
    setProgress(0);
    setPose(
      stream.length > 0
        ? { keypoints: stream[0].keypoints, timestamp: stream[0].timestamp, confidence: stream[0].confidence }
        : null,
    );
  }, [stream]);

  return { pose, isPlaying, progress, play, pause, seek };
}
