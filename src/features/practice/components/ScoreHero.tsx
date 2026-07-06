import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { colors } from '@/config/theme/colors';
import { spacing } from '@/config/theme/spacing';
import { typography } from '@/config/theme/typography';

export function scoreColor(score: number): string {
  if (score >= 80) return colors.success;
  if (score >= 60) return colors.warning;
  return colors.error;
}

export function scoreLabel(score: number): string {
  if (score >= 90) return 'PERFECT';
  if (score >= 75) return 'GREAT';
  if (score >= 60) return 'GOOD';
  return 'KEEP TRYING';
}

interface ScoreHeroProps {
  score: number;
  subtitle?: string;
}

// Shared score-reveal primitive — used by the full-session ResultsScreen and
// the per-drill DrillCompleteOverlay so both share one visual language.
export const ScoreHero: React.FC<ScoreHeroProps> = ({ score, subtitle }) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 400 });
    scale.value = withSpring(1, { damping: 12, stiffness: 100 });
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const col = scoreColor(score);

  return (
    <Animated.View style={[styles.hero, style]}>
      <Text style={[styles.label, { color: col }]}>{scoreLabel(score)}</Text>
      <Text style={[styles.number, { color: col }]}>{score}</Text>
      <Text style={styles.unit}>/ 100</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 3,
    marginBottom: spacing.xs,
  },
  number: {
    fontSize: 96,
    fontWeight: typography.fontWeight.bold,
    lineHeight: 96,
  },
  unit: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.lg,
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
  },
});
