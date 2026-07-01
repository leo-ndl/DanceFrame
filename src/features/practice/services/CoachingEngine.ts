import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { GEMINI_API_KEY } from '@/config/env';
import { RollingAnalysisOutput, CoachingEvent } from '../hooks/useRollingAnalysis';
import { MetricsSnapshot } from '../hooks/useMetrics';

const THROTTLE_MS = 8000;
const DEDUP_WINDOW = 3;

function eventSummary(event: CoachingEvent): string {
  switch (event.type) {
    case 'improvement':
      return `score improved by ${event.deltaScore.toFixed(0)} points`;
    case 'repeatedMistake':
      return `repeated mistake: ${event.bodyPart}`;
    case 'syncLoss':
      return `sync lost for ${(event.durationMs / 1000).toFixed(0)} seconds`;
    case 'recovery':
      return 'dancer recovered sync with the mascot';
    case 'exceptionalExecution':
      return `exceptional score of ${event.score.toFixed(0)}`;
  }
}

function ruleBasedFallback(
  analysis: RollingAnalysisOutput,
  metrics: MetricsSnapshot,
): string | null {
  if (!analysis.event) return null;
  const { event, dominantError, syncConfidence } = analysis;

  switch (event.type) {
    case 'improvement':
      if (event.deltaScore > 15) return 'Great improvement! Keep that energy.';
      return 'Getting better! Stay focused.';
    case 'repeatedMistake':
      return dominantError
        ? `Watch your ${dominantError.toLowerCase()}.`
        : 'Focus on your form.';
    case 'syncLoss':
      if (metrics.smoothness < 0.4) return 'Slow down and find the rhythm.';
      return 'Sync up with the mascot.';
    case 'recovery':
      return 'Nice! You found the beat again.';
    case 'exceptionalExecution':
      if (event.score > 95) return 'Perfect execution. Stay with it.';
      return 'Excellent form. Keep it up.';
    default:
      return null;
  }
}

export class CoachingEngine {
  private model: GenerativeModel | null = null;
  private lastCallMs = 0;
  private recentMessages: string[] = [];

  constructor() {
    if (GEMINI_API_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        this.model = genAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
          generationConfig: {
            maxOutputTokens: 60,
            temperature: 0.7,
          },
        });
      } catch {
        this.model = null;
      }
    }
  }

  async getSuggestion(
    analysis: RollingAnalysisOutput,
    metrics: MetricsSnapshot,
    moveName: string,
  ): Promise<string | null> {
    if (!analysis.event) return null;

    const now = Date.now();
    if (now - this.lastCallMs < THROTTLE_MS) return null;

    // Arm throttle before any path so duplicate messages don't bypass the 8s gate.
    this.lastCallMs = now;

    if (!this.model) {
      const msg = ruleBasedFallback(analysis, metrics);
      if (msg && !this.isDuplicate(msg)) {
        this.recordMessage(msg);
      }
      return msg;
    }

    try {
      const prompt = this.buildPrompt(analysis.event, analysis, metrics, moveName);
      const result = await this.model.generateContent(prompt);
      const raw = result.response.text().trim().replace(/\n/g, ' ');
      const msg = raw.slice(0, 120);

      if (!msg || this.isDuplicate(msg)) {
        return ruleBasedFallback(analysis, metrics);
      }

      this.recordMessage(msg);
      return msg;
    } catch {
      const msg = ruleBasedFallback(analysis, metrics);
      if (msg) this.recordMessage(msg);
      return msg;
    }
  }

  private buildPrompt(
    event: CoachingEvent,
    analysis: RollingAnalysisOutput,
    metrics: MetricsSnapshot,
    moveName: string,
  ): string {
    return (
      `You are a dance coach. The dancer is practicing "${moveName}".\n` +
      `Event: ${eventSummary(event)}. ` +
      `Sync: ${analysis.syncConfidence.toFixed(2)}, ` +
      `Control: ${metrics.control.toFixed(2)}, ` +
      `Smoothness: ${metrics.smoothness.toFixed(2)}.\n` +
      `Problem area: ${analysis.dominantError ?? 'general timing'}.\n` +
      `Give ONE coaching tip, 10 words max, present tense, no emoji.`
    );
  }

  private isDuplicate(msg: string): boolean {
    const lower = msg.toLowerCase();
    return this.recentMessages.some(
      m => m.toLowerCase() === lower || this.similarity(m, msg) > 0.8,
    );
  }

  private similarity(a: string, b: string): number {
    const setA = new Set(a.toLowerCase().split(/\s+/));
    const setB = new Set(b.toLowerCase().split(/\s+/));
    let shared = 0;
    for (const w of setA) if (setB.has(w)) shared++;
    return shared / Math.max(setA.size, setB.size, 1);
  }

  private recordMessage(msg: string): void {
    this.recentMessages.push(msg);
    if (this.recentMessages.length > DEDUP_WINDOW) {
      this.recentMessages.shift();
    }
  }
}

export const coachingEngine = new CoachingEngine();
