import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { colors } from '@/config/theme/colors';
import { SessionPhase } from '../types/training.types';

interface Props {
  totalDrills: number;
  currentDrillIndex: number;
  phase: SessionPhase;
  drillDurationSeconds: number;
  drillId: string;
}

export const SessionProgressBar: React.FC<Props> = ({
  totalDrills,
  currentDrillIndex,
  phase,
  drillDurationSeconds,
  drillId,
}) => {
  const fillProgress = useSharedValue(0);

  useEffect(() => {
    if (phase !== 'drill') return;
    cancelAnimation(fillProgress);
    fillProgress.value = 0;
    fillProgress.value = withTiming(1, {
      duration: drillDurationSeconds * 1000,
      easing: Easing.linear,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillId, phase]);

  const activeFillStyle = useAnimatedStyle(() => ({
    width: `${fillProgress.value * 100}%`,
  }));

  return (
    <View style={styles.container}>
      {Array.from({ length: totalDrills }, (_, i) => {
        const isDone =
          phase === 'break' || phase === 'drillComplete' ? i <= currentDrillIndex : i < currentDrillIndex;
        const isActive = i === currentDrillIndex && phase === 'drill';

        if (isDone) {
          return <View key={i} style={[styles.seg, styles.segDone]} />;
        }
        if (isActive) {
          return (
            <View key={i} style={[styles.seg, styles.segUpcoming]}>
              <Animated.View style={[styles.segFill, activeFillStyle]} />
            </View>
          );
        }
        return <View key={i} style={[styles.seg, styles.segUpcoming]} />;
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 64,
    left: 20,
    right: 20,
    flexDirection: 'row',
    gap: 4,
    zIndex: 20,
  },
  seg: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  segDone: {
    backgroundColor: colors.primary[500],
  },
  segUpcoming: {
    backgroundColor: 'rgba(236,239,238,0.14)',
  },
  segFill: {
    height: '100%',
    backgroundColor: colors.primary[500],
    borderRadius: 2,
  },
});
