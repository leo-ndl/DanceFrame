import { Difficulty } from '@/shared/types/common.types';
import { PoseFrameResult } from '@/core/ai/types/ml.types';
import { MotionRepresentation } from '@/features/import/types/motion.types';
import { BeatSegment } from '@/features/import/types/beatSegment.types';

export interface Move {
  id: string;
  name: string;
  difficulty: Difficulty;
  description: string;
  videoUrl: string;
  keyPoints: string[];
  // Legacy pose-comparison fields — still read by useDrillScoring/usePracticeSession
  // for curated moves and any move with real pose data. New imports (video-based
  // practice pivot) leave these empty/undefined; keep populating for curated moves.
  referencePoses: PoseFrameResult[];
  duration: number;
  bpm: number;
  thumbnailUrl?: string;
  // Populated when the move was imported from a user video.
  importedVideoUri?: string;
  importedAt?: number;
  isImported?: boolean;
  motionRepresentation?: MotionRepresentation;
  // Beat-based segments for imported videos (video-based practice pivot).
  segments?: BeatSegment[];
}

export interface MoveProgress {
  moveId: string;
  bestScore: number;
  attempts: number;
  lastPracticed: number;
  mastered: boolean;
}