import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  count: number;
}

export const CountdownOverlay: React.FC<Props> = ({ count }) => {
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = 0.3;
    opacity.value = 0;
    scale.value = withSpring(1, { damping: 8, stiffness: 200 });
    opacity.value = withTiming(1, { duration: 120 });
  }, [count]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const label = count <= 0 ? 'GO!' : String(count);

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.circle, animStyle]}>
        <Text style={styles.countText}>{label}</Text>
      </Animated.View>
      <Text style={styles.hint}>Get ready…</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(31,224,201,0.15)',
    borderWidth: 3,
    borderColor: 'rgba(31,224,201,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  countText: {
    color: '#fff',
    fontSize: 72,
    fontWeight: '800',
    lineHeight: 80,
  },
  hint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 18,
    fontWeight: '500',
  },
});
