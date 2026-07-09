import { issueKeyFor, UnifiedCoachingEvent } from '../types/coaching.types';

// Pure decision logic (FR-4): given whatever events fired this tick, pick at
// most ONE to act on, and flag whether it's important enough to bypass
// TrainingCoachingEngine's normal 3s throttle (FR-7's stated exceptions:
// exercise completion, significant improvement, or a persistent issue).
// The 3s throttle itself — not this function — is what prevents "redundant"
// coaching from spamming the dancer; this function only decides *what* is
// worth flagging when the throttle next opens, and *how urgently*.

const PRIORITY: UnifiedCoachingEvent['kind'][] = [
  'exerciseCompletion',
  'repeatedMistake',
  'syncLoss',
  'rhythmLoss',
  'improvement',
  'recovery',
  'significantImprovement',
  'exceptionalExecution',
  'excellentExecution',
  'reducedAmplitude',
  'rhythmRecovery',
];

const PERSISTENT_STREAK_THRESHOLD = 3;

export interface IssueRecord {
  streak: number;
  lastSeenAt: number;
}

export interface DecisionInput {
  comparedEvent: UnifiedCoachingEvent | null;
  referenceFreeEvent: UnifiedCoachingEvent | null;
  sessionEvent: UnifiedCoachingEvent | null;
  /** Mutated in place — owned/persisted by the caller across ticks. */
  issueHistory: Map<string, IssueRecord>;
  now?: number;
}

export interface Decision {
  shouldRequest: boolean;
  event: UnifiedCoachingEvent | null;
  bypassThrottle: boolean;
  issueKey: string | null;
}

function pickDominant(input: DecisionInput): UnifiedCoachingEvent | null {
  const candidates = [input.sessionEvent, input.comparedEvent, input.referenceFreeEvent].filter(
    (e): e is UnifiedCoachingEvent => e !== null,
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind));
  return candidates[0];
}

export function decide(input: DecisionInput): Decision {
  const event = pickDominant(input);
  if (!event) {
    return { shouldRequest: false, event: null, bypassThrottle: false, issueKey: null };
  }

  const issueKey = issueKeyFor(event);
  const now = input.now ?? Date.now();
  const prior = input.issueHistory.get(issueKey);
  const streak = prior ? prior.streak + 1 : 1;
  input.issueHistory.set(issueKey, { streak, lastSeenAt: now });

  const bypassThrottle =
    event.kind === 'exerciseCompletion' ||
    event.kind === 'significantImprovement' ||
    streak >= PERSISTENT_STREAK_THRESHOLD;

  return { shouldRequest: true, event, bypassThrottle, issueKey };
}
