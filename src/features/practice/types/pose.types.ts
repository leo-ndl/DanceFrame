import { KeypointName } from '@/config/constants/ai';

export interface Keypoint {
  name: KeypointName;
  x: number;
  y: number;
  confidence: number;
}

export interface Pose {
  keypoints: Keypoint[];
  timestamp: number;
  confidence: number;
}

export interface ComparisonResult {
  overallScore: number;
  timingScore: number;
  precisionScore: number;
  isolationScore: number;
  jointScores: Record<string, number>;
  errors: string[];
}