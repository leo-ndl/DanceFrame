import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
} from 'react-native-reanimated';

const C = {
  bg: 'rgba(31,224,201,0.15)',
  border: 'rgba(31,224,201,0.4)',
  text: '#1FE0C9',
};

interface Props {
  label: string | null;
}

export const ImprovementFlash: React.FC<Props> = ({ label }) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-8);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    if (!label) return;
    opacity.value = withSequence(
      withTiming(1, { duration: 250 }),
      withTiming(1, { duration: 1000 }),
      withTiming(0, { duration: 250 }),
    );
    translateY.value = withSequence(
      withTiming(0, { duration: 250 }),
      withTiming(0, { duration: 1000 }),
      withTiming(-8, { duration: 250 }),
    );
  }, [label]);

  if (!label) return null;

  return (
    <Animated.View style={[styles.container, animStyle]} pointerEvents="none">
      <Animated.Text style={styles.text}>{label}</Animated.Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 110,
    alignSelf: 'center',
    zIndex: 30,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    color: C.text,
    letterSpacing: 0.3,
  },
});
