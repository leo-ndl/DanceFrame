import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/config/theme/colors';

// 'static-tip'  — drill-authored coaching tip, rotates on a timer (fallback)
// 'correction'  — live "fix your {bodyPart}" callout from a persistent dominant error
// 'coaching-ai' — CoachingEngine-generated contextual message
// 'milestone'   — combo milestone callout (5/10/20/50 streak)
export type FeedbackSource = 'static-tip' | 'correction' | 'coaching-ai' | 'milestone';

interface Props {
  text: string;
  source: FeedbackSource;
}

const SOURCE_ICON: Record<FeedbackSource, string> = {
  'static-tip': '✓',
  correction: '!',
  'coaching-ai': '✦',
  milestone: '★',
};

export const FeedbackToast: React.FC<Props> = ({ text, source }) => {
  const translateY = useSharedValue(12);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = 12;
    opacity.value = 0;
    translateY.value = withSpring(0, { damping: 14, stiffness: 180 });
    opacity.value = withTiming(1, { duration: 200 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, source]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!text) return null;

  return (
    <Animated.View
      style={[
        styles.toast,
        source === 'correction' && styles.toastWarn,
        source === 'milestone' && styles.toastMilestone,
        (source === 'static-tip' || source === 'coaching-ai') && styles.toastGood,
        animStyle,
      ]}
    >
      <View
        style={[
          styles.iconCircle,
          source === 'correction' && styles.iconWarn,
          source === 'milestone' && styles.iconMilestone,
          (source === 'static-tip' || source === 'coaching-ai') && styles.iconGood,
        ]}
      >
        <Text
          style={[
            styles.iconText,
            source === 'correction' ? styles.iconTextWarn : styles.iconTextGood,
          ]}
        >
          {SOURCE_ICON[source]}
        </Text>
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.tipText} numberOfLines={1}>{text}</Text>
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
  toastMilestone: {
    backgroundColor: 'rgba(255,170,51,0.14)',
    borderColor: 'rgba(255,170,51,0.4)',
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
  iconMilestone: {
    backgroundColor: colors.warning,
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
