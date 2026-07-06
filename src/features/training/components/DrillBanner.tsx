import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { TrainingDrill } from '../types/training.types';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING_SIZE = 56;
const STROKE = 4;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface Props {
  drill: TrainingDrill;
  timeRemaining: number;
  tipIndex: number;
  totalDrills: number;
  currentDrillIndex: number;
}

export const DrillBanner: React.FC<Props> = ({
  drill,
  timeRemaining,
  tipIndex,
  totalDrills,
  currentDrillIndex,
}) => {
  const progress = useSharedValue(0);

  // Animate the ring from full to empty over the drill duration
  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: drill.durationSeconds * 1000,
      easing: Easing.linear,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drill.id]);

  const animProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * progress.value,
  }));

  const tip = drill.coachingTips[tipIndex % drill.coachingTips.length] ?? '';

  const dots = Array.from({ length: totalDrills }, (_, i) => i);

  return (
    <View style={styles.banner}>
      {/* Progress dots */}
      <View style={styles.dotsRow}>
        {dots.map(i => (
          <View
            key={i}
            style={[
              styles.dot,
              i < currentDrillIndex && styles.dotDone,
              i === currentDrillIndex && styles.dotActive,
            ]}
          />
        ))}
      </View>

      {/* Main row: ring timer + drill info */}
      <View style={styles.mainRow}>
        {/* Countdown ring */}
        <View style={styles.ringContainer}>
          <Svg width={RING_SIZE} height={RING_SIZE}>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={STROKE}
              fill="none"
            />
            <AnimatedCircle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              stroke="rgba(168,85,247,0.9)"
              strokeWidth={STROKE}
              fill="none"
              strokeDasharray={CIRCUMFERENCE}
              animatedProps={animProps}
              strokeLinecap="round"
              rotation="-90"
              origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
            />
          </Svg>
          <View style={styles.ringLabel}>
            <Text style={styles.ringTime}>{timeRemaining}</Text>
          </View>
        </View>

        {/* Drill info */}
        <View style={styles.drillInfo}>
          <Text style={styles.drillName} numberOfLines={1}>{drill.name}</Text>
          <Text style={styles.drillTip} numberOfLines={2}>{tip}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15,23,42,0.90)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotDone: { backgroundColor: 'rgba(16,185,129,0.7)' },
  dotActive: { backgroundColor: 'rgba(168,85,247,0.9)', width: 18 },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  ringContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringTime: { color: '#fff', fontSize: 16, fontWeight: '700' },
  drillInfo: { flex: 1 },
  drillName: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  drillTip: { color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 18 },
});
