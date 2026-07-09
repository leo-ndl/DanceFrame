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
  // Optional link to a Move with real reference-pose data (movesData.ts or an
  // imported move). When set AND the linked move has usable pose data, the
  // drill gets real pose-comparison scoring; otherwise it falls back to a
  // motion-activity heuristic. Populating this for more drills is a content
  // task (recording/importing reference poses), not an engineering one.
  moveId?: string;
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

export interface CompletedDrillResult {
  drillId: string;
  moveId?: string;
  scoreMode: 'compared' | 'heuristic';
  avgScore: number | null; // null when heuristic mode produced no comparable technique score
  bestCombo: number;
  isNewBest: boolean;
  // Running average of the reference-free motion-window summary across this
  // drill attempt (rhythm/balance/smoothness/amplitude, each 0-1). Feeds the
  // end-of-session summary (FR-10) — optional since older persisted results
  // predate this field.
  skillAverages?: { rhythm: number; balance: number; smoothness: number; amplitude: number };
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
  drillResults?: CompletedDrillResult[];
}

export type SessionPhase = 'idle' | 'countdown' | 'drill' | 'drillComplete' | 'break' | 'complete';
