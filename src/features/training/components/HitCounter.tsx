import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withSpring } from 'react-native-reanimated';
import { colors } from '@/config/theme/colors';

interface Props {
  count: number;
  combo?: number;
  justHit?: boolean;
}

export const HitCounter: React.FC<Props> = ({ count, combo = 0, justHit = false }) => {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!justHit) return;
    scale.value = withSequence(withSpring(1.15, { damping: 8 }), withSpring(1));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justHit]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.card, animStyle]}>
      <Text style={styles.num}>{count}</Text>
      <Text style={styles.label}>HITS</Text>
      {combo > 1 && <Text style={styles.comboText}>×{combo}</Text>}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    top: 96,
    left: 16,
    zIndex: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  num: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
    lineHeight: 28,
  },
  label: {
    fontSize: 8,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    fontWeight: '700',
    marginTop: 3,
  },
  comboText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary[500],
    marginTop: 2,
  },
});
