import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MetricsSnapshot } from '../hooks/useMetrics';

const C = {
  bg: 'rgba(10,14,14,0.82)',
  border: 'rgba(31,224,201,0.25)',
  text: '#ECEFEE',
  dim: '#69767A',
  accent: '#1FE0C9',
};

const COACHING_LIBRARY: Record<keyof MetricsSnapshot, string[]> = {
  control: [
    'Focus on hitting the exact positions.',
    'Slow down slightly to improve precision.',
    'Lock in each pose before moving on.',
  ],
  flow: [
    'Match the mascot timing more closely.',
    'Feel the rhythm — let it guide you.',
    'Try to move with the music, not against it.',
  ],
  smoothness: [
    'Move more fluidly between poses.',
    'Avoid jerky transitions — glide through.',
    'Think water, not stop-and-go.',
  ],
  balance: [
    'Center your weight evenly over your feet.',
    'Keep your hips level throughout.',
    'Ground yourself before each move.',
  ],
  stability: [
    'Keep your core engaged for stability.',
    'Try to minimize unnecessary hip movement.',
    'Steady base leads to cleaner moves.',
  ],
  symmetry: [
    'Check that both sides mirror each other.',
    'Your left and right arms should match.',
    'Imagine a line down the center — stay balanced.',
  ],
  rangeOfMotion: [
    'Extend fully — commit to each movement.',
    'Push a little further on arm extensions.',
    'Bigger range, bigger impact.',
  ],
};

const COACHING_INTERVAL_MS = 5000;
const OVERRIDE_DURATION_MS = 2500;

interface Props {
  metrics: MetricsSnapshot;
  hintLevel: 'full' | 'reduced' | 'minimal';
  /** Boxed so that repeating the same text still re-triggers the override effect. */
  externalMessage?: { text: string; id: number } | null;
}

export const CoachingPanel: React.FC<Props> = ({ metrics, hintLevel, externalMessage }) => {
  const [message, setMessage] = useState<string>('');
  const msgIndexRef = useRef<Record<string, number>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const overrideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overrideActiveRef = useRef(false);

  const pickCoachingMessage = () => {
    if (hintLevel === 'minimal') return;

    // Find weakest metric
    const entries = Object.entries(metrics) as [keyof MetricsSnapshot, number][];
    const weakest = entries.reduce((min, e) => e[1] < min[1] ? e : min, entries[0]);
    if (!weakest) return;

    const [key] = weakest;
    const msgs = COACHING_LIBRARY[key];
    const idx = (msgIndexRef.current[key] ?? 0) % msgs.length;
    msgIndexRef.current[key] = idx + 1;
    setMessage(msgs[idx]);
  };

  // Coaching rotation
  useEffect(() => {
    pickCoachingMessage();
    timerRef.current = setInterval(pickCoachingMessage, COACHING_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [metrics, hintLevel]);

  // External message override (AI coaching or combo achievements)
  useEffect(() => {
    if (!externalMessage) return;
    overrideActiveRef.current = true;
    setMessage(externalMessage.text);
    if (overrideTimerRef.current) clearTimeout(overrideTimerRef.current);
    overrideTimerRef.current = setTimeout(() => {
      overrideActiveRef.current = false;
      pickCoachingMessage();
    }, OVERRIDE_DURATION_MS);
  }, [externalMessage]);

  useEffect(() => {
    return () => {
      if (overrideTimerRef.current) clearTimeout(overrideTimerRef.current);
    };
  }, []);

  if (!message || hintLevel === 'minimal') return null;

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>💡</Text>
      <Text style={styles.text} numberOfLines={2}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 116,
    zIndex: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  icon: { fontSize: 16 },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
    lineHeight: 18,
  },
});
