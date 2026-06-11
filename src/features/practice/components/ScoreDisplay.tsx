import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { colors } from '@/config/theme/colors';
import { typography } from '@/config/theme/typography';
import { spacing } from '@/config/theme/spacing';

interface Props {
  score: number;
  combo: number;
}

export const ScoreDisplay: React.FC<Props> = ({ score, combo }) => {
  const animScore = useSharedValue(0);
  const scale = useSharedValue(1);
  const colorProgress = useSharedValue(0);

  useEffect(() => {
    animScore.value = withSpring(score, { damping: 14, stiffness: 80 });
    // 0 = red, 0.5 = yellow, 1 = green
    colorProgress.value = withTiming(score / 100, { duration: 500 });
    // Pulse on score change
    scale.value = withSpring(1.15, { damping: 8 }, () => {
      scale.value = withSpring(1, { damping: 10 });
    });
  }, [score]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const scoreTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      colorProgress.value,
      [0, 0.6, 1],
      [colors.error, colors.warning, colors.success],
    ),
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <Animated.Text style={[styles.score, scoreTextStyle]}>
        {Math.round(score)}
      </Animated.Text>
      <Text style={styles.label}>SCORE</Text>
      {combo > 2 && (
        <View style={styles.comboBadge}>
          <Text style={styles.comboText}>🔥 x{combo}</Text>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 14,
    padding: spacing.md,
    alignItems: 'center',
    minWidth: 80,
  },
  score: {
    fontSize: 36,
    fontWeight: typography.fontWeight.bold,
    lineHeight: 40,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 2,
  },
  comboBadge: {
    marginTop: spacing.xs,
    backgroundColor: 'rgba(245,158,11,0.2)',
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  comboText: {
    color: colors.warning,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
});
