import { STORAGE_KEYS } from '@/config/constants/app';
import { mmkvStorage } from '@/core/storage';
import { generateId } from '@/shared/utils/helper';
import {
  CompletedPlanSession,
  DaySession,
  TrainingPlan,
} from '@/features/training/types/training.types';

const MAX_SESSIONS = 90;

class TrainingPlanRepository {
  getActivePlan(): TrainingPlan | null {
    return mmkvStorage.get<TrainingPlan>(STORAGE_KEYS.TRAINING_PLAN);
  }

  saveActivePlan(plan: TrainingPlan): void {
    mmkvStorage.set(STORAGE_KEYS.TRAINING_PLAN, plan);
  }

  clearActivePlan(): void {
    mmkvStorage.delete(STORAGE_KEYS.TRAINING_PLAN);
  }

  markDayComplete(dayNumber: number, stats: CompletedPlanSession): void {
    const plan = this.getActivePlan();
    if (!plan) return;

    const updatedSessions = plan.sessions.map((s: DaySession) =>
      s.dayNumber === dayNumber
        ? { ...s, isCompleted: true, completedAt: Date.now() }
        : s,
    );

    this.saveActivePlan({ ...plan, sessions: updatedSessions });

    const history = this.getCompletedSessions();
    const updated = [...history, stats];
    if (updated.length > MAX_SESSIONS) updated.splice(0, updated.length - MAX_SESSIONS);
    mmkvStorage.set(STORAGE_KEYS.PLAN_SESSIONS, updated);
  }

  getCompletedSessions(): CompletedPlanSession[] {
    return mmkvStorage.get<CompletedPlanSession[]>(STORAGE_KEYS.PLAN_SESSIONS) ?? [];
  }

  getSessionById(id: string): CompletedPlanSession | null {
    return this.getCompletedSessions().find(s => s.id === id) ?? null;
  }

  getCurrentDayNumber(): number | null {
    const plan = this.getActivePlan();
    if (!plan) return null;
    const dayNumber =
      Math.floor((Date.now() - plan.startDate) / (1000 * 60 * 60 * 24)) + 1;
    return Math.min(dayNumber, 30);
  }

  buildSessionId(): string {
    return generateId();
  }
}

export const trainingPlanRepository = new TrainingPlanRepository();
