import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { colors } from '@/config/theme/colors';
import { typography } from '@/config/theme/typography';
import { spacing } from '@/config/theme/spacing';

interface Props {
  message: string | null;
  onDismissed?: () => void;
}

export const MicroFeedback: React.FC<Props> = ({ message, onDismissed }) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(30);
  const lastMessage = useRef<string | null>(null);

  useEffect(() => {
    if (!message || message === lastMessage.current) return;
    lastMessage.current = message;

    // Animate in, hold, animate out.
    opacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(1800, withTiming(0, { duration: 300 })),
    );
    translateY.value = withSequence(
      withSpring(0, { damping: 12 }),
      withDelay(1800, withTiming(20, { duration: 300 }, () => {
        if (onDismissed) runOnJS(onDismissed)();
      })),
    );
  }, [message]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!message) return null;

  return (
    <Animated.View style={[styles.container, style]} pointerEvents="none">
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 140,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  text: {
    color: colors.text,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
  },
});
