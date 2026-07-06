import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, Line } from 'react-native-svg';
import { AI_CONSTANTS } from '@/config/constants/ai';
import { Pose } from '@/features/practice/types/pose.types';

type Quality = 'good' | 'partial' | 'poor';

const QUALITY_CONFIG: Record<Quality, { label: string; color: string }> = {
  good: { label: 'Ready', color: '#22c55e' },
  partial: { label: 'Step back a little', color: '#f59e0b' },
  poor: { label: 'Full body not in frame', color: 'rgba(255,255,255,0.45)' },
};

function getQuality(pose: Pose | null): Quality {
  if (!pose) { return 'poor'; }
  const visible = pose.keypoints.filter(kp => kp.confidence >= AI_CONSTANTS.MIN_CONFIDENCE).length;
  if (visible >= 13) { return 'good'; }
  if (visible >= 7) { return 'partial'; }
  return 'poor';
}

interface SilhouetteProps {
  pose: Pose | null;
  width: number;
  height: number;
}

export const CalibrationSilhouette: React.FC<SilhouetteProps> = ({ pose, width, height }) => {
  const quality = getQuality(pose);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: quality === 'good' ? 0 : 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [quality, opacity]);

  const bodyScale = Math.min(width * 0.45, height * 0.25);
  const ox = width * 0.5;
  const oy = height * 0.40;

  const stroke = 'rgba(255,255,255,0.22)';
  const sw = 2;
  const dash = [5, 5] as unknown as string;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      <Svg width={width} height={height}>
        {/* Head */}
        <Ellipse
          cx={ox}
          cy={oy - bodyScale * 1.5}
          rx={bodyScale * 0.18}
          ry={bodyScale * 0.22}
          stroke={stroke}
          strokeWidth={sw}
          strokeDasharray={dash}
          fill="none"
        />
        {/* Torso */}
        <Line
          x1={ox} y1={oy - bodyScale}
          x2={ox} y2={oy}
          stroke={stroke} strokeWidth={sw} strokeDasharray={dash}
        />
        {/* Shoulders */}
        <Line
          x1={ox - bodyScale * 0.25} y1={oy - bodyScale}
          x2={ox + bodyScale * 0.25} y2={oy - bodyScale}
          stroke={stroke} strokeWidth={sw} strokeDasharray={dash}
        />
        {/* Hips */}
        <Line
          x1={ox - bodyScale * 0.15} y1={oy}
          x2={ox + bodyScale * 0.15} y2={oy}
          stroke={stroke} strokeWidth={sw} strokeDasharray={dash}
        />
        {/* Left upper arm */}
        <Line
          x1={ox - bodyScale * 0.25} y1={oy - bodyScale}
          x2={ox - bodyScale * 0.45} y2={oy - bodyScale * 0.5}
          stroke={stroke} strokeWidth={sw} strokeDasharray={dash}
        />
        {/* Left lower arm */}
        <Line
          x1={ox - bodyScale * 0.45} y1={oy - bodyScale * 0.5}
          x2={ox - bodyScale * 0.45} y2={oy + bodyScale * 0.1}
          stroke={stroke} strokeWidth={sw} strokeDasharray={dash}
        />
        {/* Right upper arm */}
        <Line
          x1={ox + bodyScale * 0.25} y1={oy - bodyScale}
          x2={ox + bodyScale * 0.45} y2={oy - bodyScale * 0.5}
          stroke={stroke} strokeWidth={sw} strokeDasharray={dash}
        />
        {/* Right lower arm */}
        <Line
          x1={ox + bodyScale * 0.45} y1={oy - bodyScale * 0.5}
          x2={ox + bodyScale * 0.45} y2={oy + bodyScale * 0.1}
          stroke={stroke} strokeWidth={sw} strokeDasharray={dash}
        />
        {/* Left thigh */}
        <Line
          x1={ox - bodyScale * 0.1} y1={oy}
          x2={ox - bodyScale * 0.15} y2={oy + bodyScale * 0.9}
          stroke={stroke} strokeWidth={sw} strokeDasharray={dash}
        />
        {/* Left shin */}
        <Line
          x1={ox - bodyScale * 0.15} y1={oy + bodyScale * 0.9}
          x2={ox - bodyScale * 0.2} y2={oy + bodyScale * 1.8}
          stroke={stroke} strokeWidth={sw} strokeDasharray={dash}
        />
        {/* Right thigh */}
        <Line
          x1={ox + bodyScale * 0.1} y1={oy}
          x2={ox + bodyScale * 0.15} y2={oy + bodyScale * 0.9}
          stroke={stroke} strokeWidth={sw} strokeDasharray={dash}
        />
        {/* Right shin */}
        <Line
          x1={ox + bodyScale * 0.15} y1={oy + bodyScale * 0.9}
          x2={ox + bodyScale * 0.2} y2={oy + bodyScale * 1.8}
          stroke={stroke} strokeWidth={sw} strokeDasharray={dash}
        />
      </Svg>
    </Animated.View>
  );
};

export const CalibrationBadge: React.FC<{ pose: Pose | null }> = ({ pose }) => {
  const quality = getQuality(pose);
  const { label, color } = QUALITY_CONFIG[quality];
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
    alignSelf: 'center',
    marginBottom: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
