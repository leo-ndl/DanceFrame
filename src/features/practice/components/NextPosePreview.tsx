import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { PoseFrameResult } from '@/core/ai/types/ml.types';
import { PoseStickmanSvg } from './PoseStickmanSvg';

const RING_STROKE = 3;
const RING_PADDING = 10; // gap between stickman edge and ring

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  pose: PoseFrameResult | null;
  beatIntervalMs: number;
  mirrored: boolean;
  stickmanSize: number;
  style?: ViewStyle;
}

export const NextPosePreview: React.FC<Props> = ({
  pose,
  beatIntervalMs,
  mirrored,
  stickmanSize,
  style,
}) => {
  const ringRadius = stickmanSize / 2 + RING_PADDING;
  const svgSize = (ringRadius + RING_STROKE) * 2 + 2;
  const circumference = useMemo(() => 2 * Math.PI * ringRadius, [ringRadius]);

  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!pose || beatIntervalMs <= 0) return;
    animRef.current?.stop();
    progress.setValue(0);
    animRef.current = Animated.timing(progress, {
      toValue: circumference,
      duration: beatIntervalMs,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => {
      if (finished) progress.setValue(0);
    });
  }, [pose, beatIntervalMs, circumference]);

  const strokeDashoffset = progress.interpolate({
    inputRange: [0, circumference],
    outputRange: [circumference, 0],
  });

  return (
    <View style={[styles.container, style]} pointerEvents="none">
      <Text style={styles.label}>NEXT</Text>
      <View style={{ width: svgSize, height: svgSize, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={svgSize} height={svgSize} style={StyleSheet.absoluteFill}>
          <Circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={ringRadius}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={RING_STROKE}
            fill="none"
          />
          <AnimatedCircle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={ringRadius}
            stroke="rgba(100,180,255,0.8)"
            strokeWidth={RING_STROKE}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${svgSize / 2}, ${svgSize / 2}`}
          />
        </Svg>
        <View style={{ width: stickmanSize, height: stickmanSize, alignItems: 'center', justifyContent: 'center' }}>
          {pose ? (
            <PoseStickmanSvg pose={pose} width={stickmanSize} height={stickmanSize} mirrored={mirrored} />
          ) : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 4,
  },
  label: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
});
