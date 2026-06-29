import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { CheckpointData } from '../hooks/useCheckpoint';

const C = {
  overlay: 'rgba(0,0,0,0.78)',
  card: '#141B1B',
  border: 'rgba(31,224,201,0.3)',
  text: '#ECEFEE',
  dim: '#69767A',
  accent: '#1FE0C9',
};

interface Props {
  data: CheckpointData | null;
}

export const CheckpointOverlay: React.FC<Props> = ({ data }) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.85);
  // Tracks whether the overlay is fully hidden so we can unmount it
  const [visible, setVisible] = useState(false);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  useEffect(() => {
    if (data) {
      setVisible(true);
      opacity.value = withTiming(1, { duration: 250 });
      scale.value = withSpring(1, { damping: 14, stiffness: 100 });
    } else {
      opacity.value = withTiming(0, { duration: 200 }, finished => {
        if (finished) runOnJS(setVisible)(false);
      });
      scale.value = withTiming(0.85, { duration: 200 });
    }
  }, [data]);

  if (!visible) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]} pointerEvents="none">
      <Animated.View style={[styles.card, cardStyle]}>
        <Text style={styles.title}>CHECKPOINT</Text>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.emoji}>✅</Text>
          <View>
            <Text style={styles.rowLabel}>Strength</Text>
            <Text style={styles.rowValue}>{data?.strength}</Text>
          </View>
        </View>
        <View style={styles.row}>
          <Text style={styles.emoji}>🎯</Text>
          <View>
            <Text style={styles.rowLabel}>Focus on</Text>
            <Text style={styles.rowValue}>{data?.priority}</Text>
          </View>
        </View>
        <Text style={styles.encouragement}>{data?.encouragement}</Text>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.overlay,
  },
  card: {
    width: 260,
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 24,
    gap: 12,
    alignItems: 'center',
  },
  title: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: C.accent,
    textTransform: 'uppercase',
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'flex-start',
  },
  emoji: { fontSize: 20 },
  rowLabel: { fontSize: 10, color: C.dim, fontWeight: '600', letterSpacing: 0.5 },
  rowValue: { fontSize: 16, fontWeight: '800', color: C.text },
  encouragement: {
    fontSize: 13,
    color: C.dim,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
  },
});
