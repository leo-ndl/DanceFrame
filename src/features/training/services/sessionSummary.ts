import { CompletedDrillResult, CompletedPlanSession } from '../types/training.types';

export interface SessionSummary {
  strongestSkill: string;
  improvementArea: string;
  progressNote: string;
  nextFocus: string;
  /** Spoken once on SessionStatsScreen mount — kept short, unlike the text fields above. */
  voiceLine: string;
}

type SkillName = 'rhythm' | 'balance' | 'smoothness' | 'amplitude';

const SKILL_LABEL: Record<SkillName, string> = {
  rhythm: 'staying on rhythm',
  balance: 'balance',
  smoothness: 'smooth movement',
  amplitude: 'movement size',
};

const NEXT_FOCUS: Record<SkillName, string> = {
  rhythm: 'Next time: work on staying with the beat.',
  balance: 'Next time: focus on staying centered and stable.',
  smoothness: 'Next time: slow down to smooth out your movement.',
  amplitude: 'Next time: work on making your movements bigger.',
};

const DEFAULT_SUMMARY: SessionSummary = {
  strongestSkill: 'You showed up and moved — that counts.',
  improvementArea: 'Not enough data yet to pinpoint a focus area.',
  progressNote: 'Keep training to build a clearer picture of your progress.',
  nextFocus: 'Next time: complete a full drill for personalized feedback.',
  voiceLine: 'Nice work today!',
};

function withSkills(results: CompletedDrillResult[]): CompletedDrillResult[] {
  return results.filter(r => r.skillAverages);
}

function averageBySkill(results: CompletedDrillResult[]): Record<SkillName, number> {
  const totals: Record<SkillName, number> = { rhythm: 0, balance: 0, smoothness: 0, amplitude: 0 };
  for (const r of results) {
    const s = r.skillAverages!;
    totals.rhythm += s.rhythm;
    totals.balance += s.balance;
    totals.smoothness += s.smoothness;
    totals.amplitude += s.amplitude;
  }
  const n = results.length;
  return { rhythm: totals.rhythm / n, balance: totals.balance / n, smoothness: totals.smoothness / n, amplitude: totals.amplitude / n };
}

function compositeScore(s: CompletedDrillResult['skillAverages']): number {
  if (!s) return 0;
  return (s.rhythm + s.balance + s.smoothness + s.amplitude) / 4;
}

export function buildSessionSummary(session: CompletedPlanSession): SessionSummary {
  const scored = withSkills(session.drillResults ?? []);
  if (scored.length === 0) return DEFAULT_SUMMARY;

  const averages = averageBySkill(scored);
  const entries = Object.entries(averages) as [SkillName, number][];
  const strongest = entries.reduce((best, e) => (e[1] > best[1] ? e : best));
  const weakest = entries.reduce((worst, e) => (e[1] < worst[1] ? e : worst));

  const mid = Math.floor(scored.length / 2);
  let progressNote = 'You stayed consistent throughout the session.';
  if (scored.length >= 4) {
    const firstHalf = scored.slice(0, mid).reduce((s, r) => s + compositeScore(r.skillAverages), 0) / mid;
    const secondHalf = scored.slice(mid).reduce((s, r) => s + compositeScore(r.skillAverages), 0) / (scored.length - mid);
    if (secondHalf - firstHalf > 0.05) progressNote = 'You improved steadily as the session went on.';
    else if (firstHalf - secondHalf > 0.05) progressNote = 'Your energy was strongest early on — pace yourself for the back half next time.';
  }

  return {
    strongestSkill: `Your ${SKILL_LABEL[strongest[0]]} was the highlight of this session.`,
    improvementArea: `Focus area: ${SKILL_LABEL[weakest[0]]}.`,
    progressNote,
    nextFocus: NEXT_FOCUS[weakest[0]],
    voiceLine: `Nice work! Focus on ${SKILL_LABEL[weakest[0]]} next time.`,
  };
}
