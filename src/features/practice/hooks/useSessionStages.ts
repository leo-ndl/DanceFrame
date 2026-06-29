import { PlaybackSpeed } from './useMascotPlayback';

export type SessionStage = 'idle' | 'warmup' | 'guided' | 'challenge' | 'complete';

export interface StageConfig {
  stage: SessionStage;
  mascotSpeed: PlaybackSpeed;
  hintLevel: 'full' | 'reduced' | 'minimal';
  label: string;
}

// Module-level constants prevent new object allocation on every render.
const IDLE:      StageConfig = { stage: 'idle',      mascotSpeed: 0.5, hintLevel: 'full',    label: 'READY'     };
const WARMUP:    StageConfig = { stage: 'warmup',    mascotSpeed: 0.5, hintLevel: 'full',    label: 'WARM-UP'   };
const GUIDED:    StageConfig = { stage: 'guided',    mascotSpeed: 1,   hintLevel: 'reduced', label: 'GUIDED'    };
const CHALLENGE: StageConfig = { stage: 'challenge', mascotSpeed: 1,   hintLevel: 'minimal', label: 'CHALLENGE' };

export function useSessionStages(elapsedSeconds: number, isActive: boolean): StageConfig {
  if (!isActive)          return IDLE;
  if (elapsedSeconds < 30)  return WARMUP;
  if (elapsedSeconds < 120) return GUIDED;
  return CHALLENGE;
}
