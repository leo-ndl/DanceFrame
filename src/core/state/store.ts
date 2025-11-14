import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage as storage } from '../storage/mmkv/MMKVStorage';

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
    }),
    {
      name: 'dance-frame-app-storage',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);