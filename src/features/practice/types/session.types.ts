export interface PracticeSession {
  id: string;
  moveId: string;
  startTime: number;
  endTime: number;
  score: number;
  repsCompleted: number;
  feedback: string[];
  metrics: SessionMetrics;
}

export interface SessionMetrics {
  timingAccuracy: number;
  movementPrecision: number;
  isolationQuality: number;
  consistency: number;
}