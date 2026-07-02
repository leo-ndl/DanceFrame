import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors } from '@/config/theme/colors';

const PARTICLE_COUNT = 10;
const BURST_RADIUS = 90;
const BURST_DURATION_MS = 700;
const PARTICLE_COLORS = [colors.warning, colors.primary[500]];

interface ParticleProps {
  angle: number;
  color: string;
  delay: number;
}

const Particle: React.FC<ParticleProps> = ({ angle, color, delay }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: BURST_DURATION_MS, easing: Easing.out(Easing.cubic) }),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => {
    const dist = progress.value * BURST_RADIUS;
    return {
      transform: [
        { translateX: Math.cos(angle) * dist },
        { translateY: Math.sin(angle) * dist },
      ],
      opacity: 1 - progress.value,
    };
  });

  return <Animated.View style={[styles.particle, { backgroundColor: color }, style]} />;
};

interface Props {
  /** Fires a new burst each time this flips to true. */
  active: boolean;
}

// Lightweight radial-burst celebration built from plain animated Views — no
// confetti/Lottie library installed or needed. Reused wherever a "new best"
// or similarly celebratory moment needs a visual payoff.
export const BurstCelebration: React.FC<Props> = ({ active }) => {
  const [burstKey, setBurstKey] = useState(0);

  useEffect(() => {
    if (active) setBurstKey(k => k + 1);
  }, [active]);

  if (!active) return null;

  return (
    <View style={styles.container} pointerEvents="none" key={burstKey}>
      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
        <Particle
          key={i}
          angle={(i / PARTICLE_COUNT) * Math.PI * 2}
          color={PARTICLE_COLORS[i % PARTICLE_COLORS.length]}
          delay={i * 15}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '38%',
    left: '50%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
