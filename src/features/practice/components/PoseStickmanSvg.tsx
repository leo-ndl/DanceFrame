import React from 'react';
import Svg, { Circle, Line } from 'react-native-svg';
import { PoseFrameResult } from '@/core/ai/types/ml.types';
import { AI_CONSTANTS } from '@/config/constants/ai';

// Mirrors the 16 connections in PoseInferenceModule.m kSkeletonConnections
const CONNECTIONS: [number, number][] = [
  [0, 1], [0, 2],
  [1, 3], [2, 4],
  [5, 6],
  [5, 7], [7, 9],
  [6, 8], [8, 10],
  [5, 11], [6, 12],
  [11, 12],
  [11, 13], [13, 15],
  [12, 14], [14, 16],
];

interface Props {
  pose: PoseFrameResult;
  width: number;
  height: number;
  color?: string;
  mirrored?: boolean;
}

export const PoseStickmanSvg: React.FC<Props> = ({
  pose,
  width,
  height,
  color = 'rgba(100, 180, 255, 0.85)',
  mirrored = false,
}) => {
  const kp = pose.keypoints;

  const px = (idx: number) => {
    const raw = (kp[idx]?.x ?? 0) * width;
    return mirrored ? width - raw : raw;
  };
  const py = (idx: number) => (kp[idx]?.y ?? 0) * height;
  const visible = (idx: number) =>
    (kp[idx]?.confidence ?? 0) >= AI_CONSTANTS.MIN_CONFIDENCE;

  return (
    <Svg width={width} height={height}>
      {CONNECTIONS.map(([a, b], i) => {
        if (!visible(a) || !visible(b)) return null;
        return (
          <Line
            key={i}
            x1={px(a)} y1={py(a)}
            x2={px(b)} y2={py(b)}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        );
      })}
      {kp.map((point, i) => {
        if ((point.confidence ?? 0) < AI_CONSTANTS.MIN_CONFIDENCE) return null;
        return (
          <Circle
            key={i}
            cx={px(i)}
            cy={py(i)}
            r={3}
            fill={color}
          />
        );
      })}
    </Svg>
  );
};
