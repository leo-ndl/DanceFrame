import { Difficulty } from '@/shared/types/common.types';

export type DanceStyle = 'Popping' | 'HipHop' | 'Locking' | 'Animation' | 'House' | 'Krump';

export interface TrainingDrill {
  id: string;
  name: string;
  danceStyle: DanceStyle;
  difficulty: Difficulty;
  durationSeconds: number;
  breakSeconds: number;
  description: string;
  coachingTips: string[];
}

export interface DaySession {
  dayNumber: number;
  drills: TrainingDrill[];
  isRestDay: boolean;
  isCompleted: boolean;
  completedAt?: number;
}

export interface TrainingPlan {
  id: string;
  danceStyle: DanceStyle;
  level: Difficulty;
  sessions: DaySession[];
  createdAt: number;
  startDate: number;
}

export interface CompletedPlanSession {
  id: string;
  planId: string;
  dayNumber: number;
  drillsCompleted: number;
  drillsTotal: number;
  completedDrillNames: string[];
  totalActiveSecs: number;
  totalBreakSecs: number;
  completionRate: number;
  completedAt: number;
}

export type SessionPhase = 'idle' | 'countdown' | 'drill' | 'break' | 'complete';
