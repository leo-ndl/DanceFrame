import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

interface Props {
  confidence: number; // 0–1
}

const GREEN = 'rgba(31,224,201,0.85)';
const AMBER = 'rgba(255,180,50,0.85)';
const RED = 'rgba(255,107,74,0.85)';

const DARK_TEXT = '#0A0E0E';

function labelFor(confidence: number): string {
  if (confidence > 0.75) return 'IN SYNC';
  if (confidence >= 0.45) return 'DRIFTING';
  return 'LOST SYNC';
}

function colorFor(confidence: number): string {
  if (confidence > 0.75) return GREEN;
  if (confidence >= 0.45) return AMBER;
  return RED;
}

export const SyncIndicator: React.FC<Props> = ({ confidence }) => {
  const animStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(colorFor(confidence), { duration: 400 }),
  }));

  return (
    <Animated.View style={[styles.pill, animStyle]}>
      <Animated.Text style={styles.label}>{labelFor(confidence)}</Animated.Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    top: 108,
    right: 14,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    zIndex: 22,
  },
  label: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: DARK_TEXT,
  },
});
