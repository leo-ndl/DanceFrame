import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PoseFrameResult } from '@/core/ai/types/ml.types';
import { PoseStreamFrame } from '@/features/moves/types/motion.types';
import { useMascotPlayback, PlaybackSpeed } from '../hooks/useMascotPlayback';
import { PoseStickmanSvg } from './PoseStickmanSvg';

const MASCOT_COLOR = 'rgba(120,255,150,0.72)';
const FALLBACK_INTERVAL_MS = 1000;

const PANEL_WIDTH = 108;
const PANEL_HEIGHT = 148;
const LABEL_HEIGHT = 20;
const INNER_WIDTH = PANEL_WIDTH - 8;
const INNER_HEIGHT = PANEL_HEIGHT - LABEL_HEIGHT - 8;

interface Props {
  stream: PoseStreamFrame[];
  fallbackPoses: PoseFrameResult[];
  speed: PlaybackSpeed;
  onProgress: (progress: number) => void;
}

export const MascotPanel: React.FC<Props> = ({
  stream,
  fallbackPoses,
  speed,
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

  const activePose: PoseFrameResult | null = hasStream
    ? streamPose
    : (fallbackPoses[fallbackIdx] ?? null);

  if (!activePose) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <Text style={styles.label}>REFERENCE</Text>
      <View style={styles.svgWrap}>
        <PoseStickmanSvg
          pose={activePose}
          width={INNER_WIDTH}
          height={INNER_HEIGHT}
          color={MASCOT_COLOR}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 140,
    left: 16,
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    zIndex: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(10,14,14,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  label: {
    fontSize: 9,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    textTransform: 'uppercase',
    height: LABEL_HEIGHT,
  },
  svgWrap: {
    width: INNER_WIDTH,
    height: INNER_HEIGHT,
  },
});
