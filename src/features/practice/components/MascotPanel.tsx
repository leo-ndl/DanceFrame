import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { PoseFrameResult } from '@/core/ai/types/ml.types';
import { PoseStreamFrame } from '@/features/moves/types/motion.types';
import { useMascotPlayback, PlaybackSpeed } from '../hooks/useMascotPlayback';
import { PoseStickmanSvg } from './PoseStickmanSvg';

const MASCOT_COLOR = 'rgba(120,255,150,0.72)';
const FALLBACK_INTERVAL_MS = 1000;

interface Props {
  stream: PoseStreamFrame[];
  fallbackPoses: PoseFrameResult[];
  speed: PlaybackSpeed;
  screenWidth: number;
  screenHeight: number;
  onProgress: (progress: number) => void;
}

export const MascotPanel: React.FC<Props> = ({
  stream,
  fallbackPoses,
  speed,
  screenWidth,
  screenHeight,
  onProgress,
}) => {
  const hasStream = stream.length > 1;

  // ── Animated stream playback ─────────────────────────────────────────────
  // onProgress is forwarded into the hook so it fires inside the same RAF batch
  // as setProgress/setPose — preventing a cascade of nested renders.
  const { pose: streamPose, play } = useMascotPlayback(stream, {
    speed,
    loop: true,
    onProgress: hasStream ? onProgress : undefined,
  });

  useEffect(() => {
    if (hasStream) play();
  }, [hasStream]);

  // ── Fallback: cycle through referencePoses when no stream ────────────────
  const [fallbackIdx, setFallbackIdx] = useState(0);
  const fallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (hasStream || fallbackPoses.length === 0) return;
    fallbackTimerRef.current = setInterval(() => {
      setFallbackIdx(i => {
        const next = (i + 1) % fallbackPoses.length;
        onProgress(next / fallbackPoses.length);
        return next;
      });
    }, FALLBACK_INTERVAL_MS);
    return () => {
      if (fallbackTimerRef.current) clearInterval(fallbackTimerRef.current);
    };
  }, [hasStream, fallbackPoses.length]);

  const mascotWidth = screenWidth * 0.55;
  const activePose: PoseFrameResult | null = hasStream
    ? streamPose
    : (fallbackPoses[fallbackIdx] ?? null);

  if (!activePose) return null;

  return (
    <View
      style={[styles.container, { width: mascotWidth, height: screenHeight }]}
      pointerEvents="none"
    >
      <PoseStickmanSvg
        pose={activePose}
        width={mascotWidth}
        height={screenHeight}
        color={MASCOT_COLOR}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 10,
  },
});
