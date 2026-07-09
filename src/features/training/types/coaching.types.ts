import { CoachingEvent } from '@/features/practice/hooks/useRollingAnalysis';

// Unifies the two independent event sources that can drive live coaching in
// PlanPracticeScreen: comparison-based events (only available when a drill
// has real reference-pose data, scoreMode === 'compared') and reference-free
// events (always available, derived purely from the user's own pose buffer).
// A third 'session' source carries non-pose signals like drill completion.
export type UnifiedCoachingEvent =
  | {
      source: 'compared';
      kind: 'improvement' | 'repeatedMistake' | 'syncLoss' | 'recovery' | 'exceptionalExecution';
      detail?: string;
      magnitude?: number;
    }
  | {
      source: 'referenceFree';
      kind: 'reducedAmplitude' | 'rhythmLoss' | 'rhythmRecovery' | 'significantImprovement' | 'excellentExecution';
      magnitude?: number;
    }
  | { source: 'session'; kind: 'exerciseCompletion' };

export function fromRollingAnalysisEvent(event: CoachingEvent): UnifiedCoachingEvent {
  switch (event.type) {
    case 'improvement':
      return { source: 'compared', kind: 'improvement', magnitude: event.deltaScore };
    case 'repeatedMistake':
      return { source: 'compared', kind: 'repeatedMistake', detail: event.bodyPart };
    case 'syncLoss':
      return { source: 'compared', kind: 'syncLoss', magnitude: event.durationMs };
    case 'recovery':
      return { source: 'compared', kind: 'recovery' };
    case 'exceptionalExecution':
      return { source: 'compared', kind: 'exceptionalExecution', magnitude: event.score };
  }
}

// issueKey identifies "the same problem" across windows for FR-4 redundant-
// coaching suppression and FR-9 coaching-memory escalation. Includes detail
// (e.g. body part) so distinct repeated mistakes don't share memory/state.
export function issueKeyFor(event: UnifiedCoachingEvent): string {
  return event.detail ? `${event.source}:${event.kind}:${event.detail}` : `${event.source}:${event.kind}`;
}
