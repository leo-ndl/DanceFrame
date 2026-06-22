import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/config/theme/colors';

interface Props {
  tip: string;
  tipIndex: number;
}

export const FeedbackToast: React.FC<Props> = ({ tip, tipIndex }) => {
  const translateY = useSharedValue(12);
  const opacity = useSharedValue(0);

  const isWarn = tipIndex % 2 !== 0;

  useEffect(() => {
    translateY.value = 12;
    opacity.value = 0;
    translateY.value = withSpring(0, { damping: 14, stiffness: 180 });
    opacity.value = withTiming(1, { duration: 200 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipIndex]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.toast,
        isWarn ? styles.toastWarn : styles.toastGood,
        animStyle,
      ]}
    >
      <View style={[styles.iconCircle, isWarn ? styles.iconWarn : styles.iconGood]}>
        <Text style={[styles.iconText, isWarn ? styles.iconTextWarn : styles.iconTextGood]}>
          {isWarn ? '!' : '✓'}
        </Text>
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.tipText} numberOfLines={1}>{tip}</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 172,
    zIndex: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  toastGood: {
    backgroundColor: colors.turquoiseTint,
    borderColor: 'rgba(31,224,201,0.35)',
  },
  toastWarn: {
    backgroundColor: colors.coralTint,
    borderColor: 'rgba(255,107,74,0.4)',
  },
  iconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconGood: {
    backgroundColor: colors.primary[500],
  },
  iconWarn: {
    backgroundColor: colors.secondary[500],
  },
  iconText: {
    fontSize: 12,
    fontWeight: '900',
  },
  iconTextGood: {
    color: '#063a33',
  },
  iconTextWarn: {
    color: '#3a1505',
  },
  textBlock: {
    flex: 1,
  },
  tipText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.01,
  },
});
