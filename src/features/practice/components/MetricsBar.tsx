import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import { MetricsSnapshot } from '../hooks/useMetrics';

const C = {
  bg: 'rgba(10,14,14,0.78)',
  border: 'rgba(236,239,238,0.08)',
  label: '#69767A',
  accent: '#1FE0C9',
};

const METRICS: { key: keyof MetricsSnapshot; label: string }[] = [
  { key: 'control', label: 'CTRL' },
  { key: 'flow', label: 'FLOW' },
  { key: 'smoothness', label: 'SMTH' },
  { key: 'balance', label: 'BLNC' },
  { key: 'stability', label: 'STAB' },
  { key: 'symmetry', label: 'SYMM' },
  { key: 'rangeOfMotion', label: 'ROM' },
];

const BAR_MAX_WIDTH = 52;

interface MetricRowProps {
  label: string;
  value: number;
}

function MetricRow({ label, value }: MetricRowProps) {
  const barWidth = useSharedValue(0);
  const barStyle = useAnimatedStyle(() => ({ width: barWidth.value }));

  useEffect(() => {
    barWidth.value = withTiming(value * BAR_MAX_WIDTH, { duration: 300 });
  }, [value]);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, barStyle]} />
      </View>
    </View>
  );
}

interface Props {
  metrics: MetricsSnapshot;
}

export const MetricsBar: React.FC<Props> = ({ metrics }) => {
  return (
    <View style={styles.container}>
      {METRICS.map(m => (
        <MetricRow key={m.key} label={m.label} value={metrics[m.key]} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 8,
    top: 120,
    width: 80,
    backgroundColor: C.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 6,
    zIndex: 20,
  },
  row: {
    gap: 3,
  },
  label: {
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: C.label,
  },
  track: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    width: BAR_MAX_WIDTH,
  },
  fill: {
    height: '100%',
    backgroundColor: C.accent,
    borderRadius: 2,
  },
});
