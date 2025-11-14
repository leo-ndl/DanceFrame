import { Difficulty } from '@/shared/types/common.types';

export interface Move {
  id: string;
  name: string;
  difficulty: Difficulty;
  description: string;
  videoUrl: string;
  keyPoints: string[];
  referencePoses: any[]; // Will be properly typed later
  duration: number;
  bpm: number;
  thumbnailUrl?: string;
}

export interface MoveProgress {
  moveId: string;
  bestScore: number;
  attempts: number;
  lastPracticed: number;
  mastered: boolean;
}