import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { GEMINI_API_KEY } from '@/config/env';
import { MotionWindowSummary } from '../hooks/useReferenceFreeCoachAnalysis';
import { Decision } from './coachingDecisionEngine';
import { TrainingDrill } from '../types/training.types';

// A separate engine from src/features/practice/services/CoachingEngine.ts —
// deliberately not shared. That engine is a module-level singleton imported
// live by the (out-of-scope) PracticeScreen; editing it in place would
// change PracticeScreen's runtime behavior even without touching its file.

const MIN_INTERVAL_MS = 3000; // FR-7
const MAX_WORDS = 5; // FR-6
const MEMORY_LOOKBACK = 2; // FR-9

type Category4 = 'Poor' | 'Fair' | 'Good' | 'Excellent';
type BalanceCategory = 'Unstable' | 'Stable' | 'Very Stable';
type SmoothnessCategory = 'Choppy' | 'Improving' | 'Smooth';
type AmplitudeCategory = 'Low' | 'Moderate' | 'High';

export interface MovementSummaryInput {
  trainingGoal: string;
  exercise: string;
  windowDuration: number;
  movementSummary: {
    rhythm: Category4;
    balance: BalanceCategory;
    smoothness: SmoothnessCategory;
    amplitude: AmplitudeCategory;
    activeBodyParts: string[];
    trend: MotionWindowSummary['trend'];
  };
  event: string;
  context: { danceStyle: string; difficulty: string };
  priorAdvice: string[];
}

const EVENT_LABELS: Record<string, string> = {
  exerciseCompletion: 'Exercise Completed',
  repeatedMistake: 'Repeated Mistake',
  syncLoss: 'Sync Lost',
  rhythmLoss: 'Rhythm Lost',
  improvement: 'Score Improving',
  recovery: 'Sync Recovered',
  significantImprovement: 'Significant Improvement',
  exceptionalExecution: 'Exceptional Execution',
  excellentExecution: 'Excellent Execution',
  reducedAmplitude: 'Low Movement Amplitude',
  rhythmRecovery: 'Rhythm Recovered',
};

const FIRST_TIME_FALLBACK: Record<string, string> = {
  reducedAmplitude: 'Move bigger.',
  rhythmLoss: 'Feel the rhythm.',
  repeatedMistake: 'Fix your form.',
  syncLoss: 'Find the beat.',
  exerciseCompletion: 'Nice work!',
  significantImprovement: 'Great progress!',
  improvement: 'Getting better!',
  excellentExecution: 'Excellent form!',
  exceptionalExecution: 'Perfect execution!',
  recovery: 'Nice recovery!',
  rhythmRecovery: 'Back on beat!',
};

const REINFORCE_FALLBACK = ['Keep that up!', 'Nice, stay there.', 'Good, keep going!'];

function toCategory4(value: number): Category4 {
  if (value < 0.35) return 'Poor';
  if (value < 0.55) return 'Fair';
  if (value < 0.8) return 'Good';
  return 'Excellent';
}

function toBalanceCategory(value: number): BalanceCategory {
  if (value < 0.45) return 'Unstable';
  if (value < 0.75) return 'Stable';
  return 'Very Stable';
}

function toSmoothnessCategory(value: number, trend: MotionWindowSummary['trend']): SmoothnessCategory {
  if (trend === 'improving') return 'Improving';
  return value < 0.5 ? 'Choppy' : 'Smooth';
}

function toAmplitudeCategory(value: number): AmplitudeCategory {
  if (value < 0.35) return 'Low';
  if (value < 0.65) return 'Moderate';
  return 'High';
}

function truncateToWords(text: string, maxWords: number): string {
  return text.trim().split(/\s+/).slice(0, maxWords).join(' ');
}

export class TrainingCoachingEngine {
  private model: GenerativeModel | null = null;
  private lastCallMs = 0;
  private issueMemory = new Map<string, string[]>();

  constructor() {
    if (GEMINI_API_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        this.model = genAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
          generationConfig: { maxOutputTokens: 16, temperature: 0.7 },
        });
      } catch {
        this.model = null;
      }
    }
  }

  resetMemory(): void {
    this.issueMemory.clear();
  }

  async getSuggestion(
    decision: Decision,
    summary: MotionWindowSummary,
    drill: TrainingDrill,
  ): Promise<string | null> {
    if (!decision.shouldRequest || !decision.event || !decision.issueKey) return null;

    const now = Date.now();
    if (!decision.bypassThrottle && now - this.lastCallMs < MIN_INTERVAL_MS) return null;
    this.lastCallMs = now;

    const priorAdvice = this.issueMemory.get(decision.issueKey) ?? [];
    const input = this.buildStructuredInput(decision, summary, drill, priorAdvice);

    let msg: string;
    if (!this.model) {
      msg = this.ruleBasedFallback(decision, priorAdvice);
    } else {
      try {
        const result = await this.model.generateContent(this.buildPrompt(input));
        const raw = result.response.text().trim().replace(/\n/g, ' ');
        msg = truncateToWords(raw, MAX_WORDS) || this.ruleBasedFallback(decision, priorAdvice);
      } catch {
        msg = this.ruleBasedFallback(decision, priorAdvice);
      }
    }

    this.recordAdvice(decision.issueKey, msg);
    return msg;
  }

  private buildStructuredInput(
    decision: Decision,
    summary: MotionWindowSummary,
    drill: TrainingDrill,
    priorAdvice: string[],
  ): MovementSummaryInput {
    return {
      trainingGoal: drill.description,
      exercise: drill.name,
      windowDuration: 4,
      movementSummary: {
        rhythm: toCategory4(summary.rhythm),
        balance: toBalanceCategory(summary.balance),
        smoothness: toSmoothnessCategory(summary.smoothness, summary.trend),
        amplitude: toAmplitudeCategory(summary.amplitude),
        activeBodyParts: summary.activeRegions,
        trend: summary.trend,
      },
      event: EVENT_LABELS[decision.event?.kind ?? ''] ?? 'Movement Update',
      context: { danceStyle: drill.danceStyle, difficulty: drill.difficulty },
      priorAdvice,
    };
  }

  private buildPrompt(input: MovementSummaryInput): string {
    return (
      'You are a supportive dance coach speaking live to a dancer mid-exercise.\n' +
      `Movement data (JSON): ${JSON.stringify(input)}\n` +
      'Respond with ONE short spoken coaching line, MAXIMUM 5 WORDS, positive and ' +
      'action-oriented, easy to understand while dancing. No punctuation-heavy or ' +
      'multi-sentence output. If "priorAdvice" is non-empty, do NOT repeat it — ' +
      'acknowledge progress or briefly reinforce instead (e.g. "Better!", "Keep that height.").'
    );
  }

  private ruleBasedFallback(decision: Decision, priorAdvice: string[]): string {
    if (priorAdvice.length > 0) {
      return REINFORCE_FALLBACK[priorAdvice.length % REINFORCE_FALLBACK.length];
    }
    return FIRST_TIME_FALLBACK[decision.event?.kind ?? ''] ?? 'Keep going!';
  }

  private recordAdvice(issueKey: string, msg: string): void {
    const list = this.issueMemory.get(issueKey) ?? [];
    list.push(msg);
    if (list.length > MEMORY_LOOKBACK) list.shift();
    this.issueMemory.set(issueKey, list);
  }
}

export const trainingCoachingEngine = new TrainingCoachingEngine();
