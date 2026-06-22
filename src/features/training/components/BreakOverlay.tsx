import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { TrainingDrill } from '../types/training.types';

interface Props {
  timeRemaining: number;
  nextDrill: TrainingDrill | null;
}

export const BreakOverlay: React.FC<Props> = ({ timeRemaining, nextDrill }) => {
  const breathScale = useSharedValue(1);

  useEffect(() => {
    breathScale.value = withRepeat(
      withSequence(
        withTiming(1.07, { duration: 1500 }),
        withTiming(1.0, { duration: 1500 }),
      ),
      -1,
      false,
    );
  }, []);

  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathScale.value }],
  }));

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.circle, breathStyle]}>
        <Text style={styles.restLabel}>REST</Text>
        <Text style={styles.timer}>{timeRemaining}s</Text>
      </Animated.View>

      {nextDrill && (
        <View style={styles.nextCard}>
          <Text style={styles.nextLabel}>Next up</Text>
          <Text style={styles.nextName}>{nextDrill.name}</Text>
          <Text style={styles.nextDesc} numberOfLines={1}>{nextDrill.description}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
  },
  circle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(16,185,129,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  restLabel: {
    color: 'rgba(16,185,129,0.9)',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 3,
  },
  timer: {
    color: '#fff',
    fontSize: 52,
    fontWeight: '800',
    lineHeight: 56,
  },
  nextCard: {
    backgroundColor: 'rgba(30,41,59,0.85)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    width: '70%',
  },
  nextLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 4,
  },
  nextName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  nextDesc: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 },
});
