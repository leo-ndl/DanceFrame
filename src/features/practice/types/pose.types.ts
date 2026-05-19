import { PoseFrameResult, PoseKeypoint } from '@/core/ai/types/ml.types';

export type Keypoint = PoseKeypoint;

export type Pose = PoseFrameResult;

export interface ComparisonResult {
  overallScore: number;
  timingScore: number;
  precisionScore: number;
  isolationScore: number;
  jointScores: Record<string, number>;
  errors: string[];
}
