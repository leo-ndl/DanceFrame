import { GoogleGenerativeAI } from '@google/generative-ai';
import { DanceStyle, DaySession, TrainingDrill, TrainingPlan } from '../types/training.types';
import { Difficulty } from '@/shared/types/common.types';
import { generateId } from '@/shared/utils/helper';
import { getDrillsByStyleAndDifficulty, getDrillsByStyle } from '../data/drillsData';

// ── Fallback rule-based generator ────────────────────────────────────────────

function rotateDrills(pool: TrainingDrill[], offset: number, count: number): TrainingDrill[] {
  if (pool.length === 0) return [];
  const result: TrainingDrill[] = [];
  for (let i = 0; i < count; i++) {
    result.push(pool[(offset + i) % pool.length]);
  }
  return result;
}

function buildFallbackPlan(danceStyle: DanceStyle, level: Difficulty): DaySession[] {
  const beginner = getDrillsByStyleAndDifficulty(danceStyle, 'Beginner');
  const intermediate = getDrillsByStyleAndDifficulty(danceStyle, 'Intermediate');
  const advanced = getDrillsByStyleAndDifficulty(danceStyle, 'Advanced');

  const begs = beginner.length > 0 ? beginner : getDrillsByStyle(danceStyle).slice(0, 3);
  const ints = intermediate.length > 0 ? intermediate : begs;
  const advs = advanced.length > 0 ? advanced : ints;

  // Per-level starting pools
  const week1Pool = level === 'Advanced' ? [...ints, ...advs] : begs;
  const week2Pool = level === 'Beginner' ? [...begs, ...ints.slice(0, 1)] : [...ints, ...begs.slice(0, 1)];
  const week3Pool = level === 'Beginner' ? [...ints, ...advs.slice(0, 1)] : [...ints, ...advs];
  const week4Pool = level === 'Beginner' ? [...ints, ...advs] : [...advs, ...ints];

  const sessions: DaySession[] = [];

  for (let day = 1; day <= 30; day++) {
    const isRestDay = day === 7 || day === 14 || day === 21;
    let drills: TrainingDrill[];

    if (isRestDay) {
      drills = rotateDrills(begs, day, 2).map(d => ({ ...d, durationSeconds: 30, breakSeconds: 30 }));
    } else if (day <= 6) {
      const weekDayIdx = day - 1;
      drills = rotateDrills(week1Pool, weekDayIdx * 3, 3).map(d => ({ ...d, durationSeconds: 30, breakSeconds: 20 }));
    } else if (day <= 13) {
      const weekDayIdx = day - 8;
      drills = rotateDrills(week2Pool, weekDayIdx * 4, 4).map(d => ({ ...d, durationSeconds: 45, breakSeconds: 20 }));
    } else if (day <= 20) {
      const weekDayIdx = day - 15;
      const count = weekDayIdx % 2 === 0 ? 4 : 5;
      drills = rotateDrills(week3Pool, weekDayIdx * count, count).map(d => ({ ...d, durationSeconds: 60, breakSeconds: 15 }));
    } else {
      const weekDayIdx = day - 22;
      drills = rotateDrills(week4Pool, weekDayIdx * 5, 5).map(d => ({
        ...d,
        durationSeconds: weekDayIdx >= 6 ? 90 : 60,
        breakSeconds: 15,
      }));
    }

    sessions.push({
      dayNumber: day,
      drills,
      isRestDay,
      isCompleted: false,
    });
  }

  return sessions;
}

// ── Gemini-powered generator ─────────────────────────────────────────────────

const DRILL_SCHEMA = `{
  "id": "string (unique kebab-case)",
  "name": "string (move name)",
  "danceStyle": "one of: Popping | HipHop | Locking | Animation | House | Krump",
  "difficulty": "one of: Beginner | Intermediate | Advanced",
  "durationSeconds": "number (30-90)",
  "breakSeconds": "number (15-30)",
  "description": "string (one sentence describing the move)",
  "coachingTips": ["string (2-4 coaching tips)"]
}`;

const DAY_SESSION_SCHEMA = `{
  "dayNumber": "number (1-30)",
  "drills": "[TrainingDrill]",
  "isRestDay": "boolean",
  "isCompleted": false,
  "completedAt": null
}`;

function buildPrompt(danceStyle: DanceStyle, level: Difficulty): string {
  return `You are a professional dance coach specializing in street dance styles.

Create a structured 30-day ${danceStyle} training program for a ${level} student.

Rules:
- Days 7, 14, 21 are rest days with only 2 light drills (30s each, 30s break)
- Week 1 (days 1-6): 3 drills per day, 30s each, 20s break, Beginner difficulty
- Week 2 (days 8-13): 4 drills per day, 45s each, 20s break, Beginner/Intermediate mix
- Week 3 (days 15-20): 4-5 drills per day, 60s each, 15s break, Intermediate focus
- Week 4 (days 22-30): 5 drills per day, 60-90s each, 15s break, Intermediate/Advanced mix
- Adjust difficulty tier based on student level: ${level} students start with a more advanced baseline
- Each drill needs 2-4 specific, actionable coaching tips relevant to ${danceStyle}
- No two consecutive days should have the exact same drill lineup
- Drill IDs must be unique kebab-case strings

TrainingDrill schema: ${DRILL_SCHEMA}

DaySession schema: ${DAY_SESSION_SCHEMA}

Return ONLY a JSON array of exactly 30 DaySession objects. No markdown, no explanation.`;
}

async function parseGeminiResponse(
  responseText: string,
  danceStyle: DanceStyle,
  level: Difficulty,
): Promise<DaySession[]> {
  try {
    const parsed = JSON.parse(responseText);
    if (!Array.isArray(parsed) || parsed.length !== 30) {
      throw new Error(`Expected 30 sessions, got ${Array.isArray(parsed) ? parsed.length : 'non-array'}`);
    }
    // Validate and sanitize each session
    return parsed.map((s: any, index: number): DaySession => ({
      dayNumber: typeof s.dayNumber === 'number' ? s.dayNumber : index + 1,
      isRestDay: Boolean(s.isRestDay),
      isCompleted: false,
      drills: Array.isArray(s.drills)
        ? s.drills.map((d: any): TrainingDrill => ({
            id: d.id ?? generateId(),
            name: d.name ?? 'Drill',
            danceStyle: danceStyle,
            difficulty: d.difficulty ?? level,
            durationSeconds: Number(d.durationSeconds) || 45,
            breakSeconds: Number(d.breakSeconds) || 20,
            description: d.description ?? '',
            coachingTips: Array.isArray(d.coachingTips) ? d.coachingTips : [],
          }))
        : [],
    }));
  } catch (e) {
    throw new Error(`Failed to parse Gemini response: ${e}`);
  }
}

export async function generateTrainingPlan(
  danceStyle: DanceStyle,
  level: Difficulty,
  apiKey: string,
): Promise<TrainingPlan> {
  let sessions: DaySession[];

  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7,
        },
      });

      const result = await model.generateContent(buildPrompt(danceStyle, level));
      const responseText = result.response.text();
      sessions = await parseGeminiResponse(responseText, danceStyle, level);
    } catch (e) {
      console.warn('[PlanGenerator] Gemini failed, using fallback:', e);
      sessions = buildFallbackPlan(danceStyle, level);
    }
  } else {
    sessions = buildFallbackPlan(danceStyle, level);
  }

  return {
    id: generateId(),
    danceStyle,
    level,
    sessions,
    createdAt: Date.now(),
    startDate: Date.now(),
  };
}
