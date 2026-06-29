import { Difficulty } from '@/shared/types/common.types';
import { PoseFrameResult } from '@/core/ai/types/ml.types';
import { MotionRepresentation } from '@/features/import/types/motion.types';

export interface Move {
  id: string;
  name: string;
  difficulty: Difficulty;
  description: string;
  videoUrl: string;
  keyPoints: string[];
  referencePoses: PoseFrameResult[];
  duration: number;
  bpm: number;
  thumbnailUrl?: string;
  // Populated when the move was imported from a user video.
  importedVideoUri?: string;
  importedAt?: number;
  isImported?: boolean;
  motionRepresentation?: MotionRepresentation;
}

export interface MoveProgress {
  moveId: string;
  bestScore: number;
  attempts: number;
  lastPracticed: number;
  mastered: boolean;
}