import { PoseKeypoint } from '@/core/ai/types/ml.types';

export interface PoseStreamFrame {
  timestamp: number;
  keypoints: PoseKeypoint[];
  confidence: number;
  complexityScore: number;
}

export type SegmentType =
  | 'preparation'
  | 'arm_wave'
  | 'body_wave'
  | 'footwork'
  | 'turn'
  | 'freeze'
  | 'groove'
  | 'isolation'
  | 'transition';

export interface MovementMetadata {
  avgSpeed: number;
  jointVelocity: Record<string, number>;
  jointAcceleration: Record<string, number>;
  smoothness: number;
  balance: number;
  stability: number;
  symmetry: number;
  rangeOfMotion: number;
  energy: number;
  movementDensity: number;
}

export interface MovementSegment {
  startMs: number;
  endMs: number;
  durationMs: number;
  /** Inclusive indices into MotionRepresentation.stream */
  poseRange: [number, number];
  complexityScore: number;
  segmentType: SegmentType;
  metadata: MovementMetadata;
  teachingPoses: PoseStreamFrame[];
}

export interface MotionRepresentation {
  stream: PoseStreamFrame[];
  segments: MovementSegment[];
  durationMs: number;
  totalRawFrames: number;
  compressionRatio: number;
}
