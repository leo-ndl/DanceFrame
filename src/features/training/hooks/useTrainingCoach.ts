import { useEffect, useRef } from 'react';
import { RollingAnalysisOutput } from '@/features/practice/hooks/useRollingAnalysis';
import { voiceCoach } from '@/shared/utils/voiceCoach';
import { ReferenceFreeOutput } from './useReferenceFreeCoachAnalysis';
import { decide, IssueRecord } from '../services/coachingDecisionEngine';
import { trainingCoachingEngine } from '../services/TrainingCoachingEngine';
import { fromRollingAnalysisEvent, UnifiedCoachingEvent } from '../types/coaching.types';
import { TrainingDrill } from '../types/training.types';

/**
 * Glue hook: turns the two analysis streams (comparison-based + reference-
 * free) plus a session-level completion signal into spoken coaching, via
 * coachingDecisionEngine -> TrainingCoachingEngine -> voiceCoach. Purely
 * side-effecting — nothing is rendered, since voice replaces the toast.
 */
export function useTrainingCoach(
  comparedAnalysis: RollingAnalysisOutput,
  referenceFree: ReferenceFreeOutput,
  sessionEvent: UnifiedCoachingEvent | null,
  drill: TrainingDrill | null,
  isActive: boolean,
  drillAttemptId: number,
): void {
  const issueHistoryRef = useRef<Map<string, IssueRecord>>(new Map());

  useEffect(() => {
    issueHistoryRef.current = new Map();
    trainingCoachingEngine.resetMemory();
  }, [drillAttemptId]);

  useEffect(() => {
    // isActive (isDrillActive) flips false the instant phase leaves 'drill'
    // — including the same tick a drillComplete sessionEvent arrives — so a
    // bare `!isActive` guard would silently swallow the one guaranteed,
    // non-threshold-dependent speech trigger (exercise completion).
    if ((!isActive && !sessionEvent) || !drill) return;

    const comparedEvent = comparedAnalysis.event ? fromRollingAnalysisEvent(comparedAnalysis.event) : null;
    const referenceFreeEvent: UnifiedCoachingEvent | null = referenceFree.event
      ? { source: 'referenceFree', kind: referenceFree.event.type, magnitude: 'delta' in referenceFree.event ? referenceFree.event.delta : undefined }
      : null;

    const decision = decide({
      comparedEvent,
      referenceFreeEvent,
      sessionEvent,
      issueHistory: issueHistoryRef.current,
    });

    if (!decision.shouldRequest) return;

    trainingCoachingEngine
      .getSuggestion(decision, referenceFree.summary, drill)
      .then(msg => {
        if (msg) voiceCoach.speakCoaching(msg);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparedAnalysis.event, referenceFree.event, sessionEvent, isActive, drill]);
}
