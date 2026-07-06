import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage as storage } from '../storage/mmkv/MMKVStorage';
import { TrainingPlan } from '@/features/training/types/training.types';
import { trainingPlanRepository } from '@/core/data/repositories/TrainingPlanRepository';

const mmkvStorage = {
  setItem: (name: string, value: string) => {
    storage.set(name, value);
  },
  getItem: (name: string) => {
    return storage.get(name) || null;
  },
  removeItem: (name: string) => {
    storage.delete(name);
  },
};

interface AppState {
  userId: string | null;
  userName: string | null;
  currentMoveId: string | null;
  isRecording: boolean;
  selectedModel: 'lightning' | 'thunder';
  showSkeleton: boolean;
  showFeedback: boolean;
  
  setUser: (id: string, name: string) => void;
  setCurrentMove: (id: string) => void;
  startRecording: () => void;
  stopRecording: () => void;
  toggleSkeleton: () => void;
  toggleFeedback: () => void;
  reset: () => void;

  activePlan: TrainingPlan | null;
  setActivePlan: (plan: TrainingPlan | null) => void;
  markPlanDayComplete: (dayNumber: number) => void;

  streakFreezes: number;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      userId: null,
      userName: null,
      currentMoveId: null,
      isRecording: false,
      selectedModel: 'lightning',
      showSkeleton: true,
      showFeedback: true,

      setUser: (id, name) => set({ userId: id, userName: name }),
      setCurrentMove: (id) => set({ currentMoveId: id }),
      startRecording: () => set({ isRecording: true }),
      stopRecording: () => set({ isRecording: false }),
      toggleSkeleton: () => set((state) => ({ showSkeleton: !state.showSkeleton })),
      toggleFeedback: () => set((state) => ({ showFeedback: !state.showFeedback })),
      reset: () => set({
        userId: null,
        userName: null,
        currentMoveId: null,
        isRecording: false,
      }),

      streakFreezes: 2,

      activePlan: trainingPlanRepository.getActivePlan(),
      setActivePlan: (plan) => {
        if (plan) {
          trainingPlanRepository.saveActivePlan(plan);
        } else {
          trainingPlanRepository.clearActivePlan();
        }
        set({ activePlan: plan });
      },
      markPlanDayComplete: (dayNumber) => {
        set((state) => {
          if (!state.activePlan) return {};
          const updatedSessions = state.activePlan.sessions.map(s =>
            s.dayNumber === dayNumber
              ? { ...s, isCompleted: true, completedAt: Date.now() }
              : s,
          );
          const updated = { ...state.activePlan, sessions: updatedSessions };
          trainingPlanRepository.saveActivePlan(updated);
          return { activePlan: updated };
        });
      },
    }),
    {
      name: 'dance-frame-app-storage',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);