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
  strokeWidth?: number;
}

export const PoseStickmanSvg: React.FC<Props> = ({
  pose,
  width,
  height,
  color = 'rgba(100, 180, 255, 0.85)',
  mirrored = true,
  strokeWidth = 3,
}) => {
  const kp = pose.keypoints;

  // Derive portrait dimensions from the raw buffer dimensions when available
  // (shorter axis = portrait width, longer axis = portrait height). This is
  // correct whether the buffer is already portrait or still landscape.
  // Fall back to the pre-computed MIN/MAX portrait values, then screen size.
  const rW = pose.rawFrameWidth;
  const rH = pose.rawFrameHeight;
  const fW = rW && rH ? Math.min(rW, rH) : (pose.frameWidth  ?? Math.min(width, height));
  const fH = rW && rH ? Math.max(rW, rH) : (pose.frameHeight ?? Math.max(width, height));

  const coverScale = Math.max(width / fW, height / fH);
  const scaledW    = fW * coverScale;
  const scaledH    = fH * coverScale;
  const offsetX    = (width  - scaledW) / 2;
  const offsetY    = (height - scaledH) / 2;

  const px = (idx: number) => {
    const rawX = offsetX + (kp[idx]?.x ?? 0) * scaledW;
    return mirrored ? width - rawX : rawX;
  };
  const py = (idx: number) => offsetY + (kp[idx]?.y ?? 0) * scaledH;
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
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        );
      })}
      {kp.map((point, i) => {
        if ((point.confidence ?? 0) < AI_CONSTANTS.MIN_CONFIDENCE) return null;
        return (
          <React.Fragment key={i}>
            <Circle cx={px(i)} cy={py(i)} r={7} fill={color} opacity={0.22} />
            <Circle cx={px(i)} cy={py(i)} r={3} fill={color} />
          </React.Fragment>
        );
      })}
    </Svg>
  );
};
