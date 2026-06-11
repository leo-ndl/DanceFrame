export type RootStackParamList = {
  MainTabs: undefined;
  Practice: { moveId: string };
  Results: { sessionId: string };
  MoveDetail: { moveId: string };
  VideoImport: undefined;
  VideoProcessing: { videoUri: string };
};

export type MainTabParamList = {
  Dashboard: undefined;
  Progress: undefined;
  Achievements: undefined;
};

export type PracticeStackParamList = {
  Practice: { moveId: string };
  Results: { sessionId: string };
  MoveDetail: { moveId: string };
}