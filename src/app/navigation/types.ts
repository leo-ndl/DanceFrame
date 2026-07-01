export type RootStackParamList = {
  MainTabs: undefined;
  Practice: { moveId: string };
  Results: { sessionId: string };
  MoveDetail: { moveId: string };
  VideoImport: undefined;
  VideoProcessing: { videoUri: string };
  GoalSetup: undefined;
  TrainingPlan: undefined;
  DaySessionDetail: { dayNumber: number };
  PlanPractice: { dayNumber: number };
  SessionStats: { sessionStatsId: string };
  Streak: undefined;
  Calories: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Progress: undefined;
  Plan: undefined;
};

export type PracticeStackParamList = {
  Practice: { moveId: string };
  Results: { sessionId: string };
  MoveDetail: { moveId: string };
}