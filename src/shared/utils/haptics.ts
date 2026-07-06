import { Vibration } from 'react-native';

// Built-in Vibration API only (no native haptics dependency). Deliberately
// sparse: only fired at genuinely meaningful moments (combo milestones,
// personal bests, drill completion) — never per-hit, which would buzz
// continuously at ~30fps and feel like a malfunction rather than feedback.
export const haptics = {
  comboMilestone: () => Vibration.vibrate([0, 30, 40, 30]),
  personalBest: () => Vibration.vibrate([0, 40, 60, 40, 60, 60]),
  drillComplete: () => Vibration.vibrate(50),
};
