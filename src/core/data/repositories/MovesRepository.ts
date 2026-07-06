import { Move, MoveProgress } from '@/features/moves/types/move.types';
import { LocalDataSource } from '@/core/data/sources/local/LocalMovesDataSource';
import { movesData } from '@/features/moves/data/movesData';
import { STORAGE_KEYS } from '@/config/constants/app';
import { mmkvStorage } from '@/core/storage';

class MovesRepository {
  private localSource: LocalDataSource<Move>;

  constructor() {
    this.localSource = new LocalDataSource(STORAGE_KEYS.MOVES_DATA, movesData);
  }

  async getAll(): Promise<Move[]> {
    return this.localSource.getAll();
  }

  async getById(id: string): Promise<Move | null> {
    return this.localSource.getById(id);
  }

  async getMovesByDifficulty(difficulty: string): Promise<Move[]> {
    const allMoves = await this.getAll();
    return allMoves.filter(move => move.difficulty === difficulty);
  }

  async updateProgress(moveId: string, score: number): Promise<void> {
    const all = this.loadAllProgress();
    const existing = all[moveId];
    const bestScore = Math.max(score, existing?.bestScore ?? 0);
    all[moveId] = {
      moveId,
      bestScore,
      attempts: (existing?.attempts ?? 0) + 1,
      lastPracticed: Date.now(),
      mastered: bestScore >= 90,
    };
    mmkvStorage.set(STORAGE_KEYS.PROGRESS_DATA, all);
  }

  async getProgress(moveId: string): Promise<MoveProgress | null> {
    return this.loadAllProgress()[moveId] ?? null;
  }

  async getAllProgress(): Promise<MoveProgress[]> {
    return Object.values(this.loadAllProgress());
  }

  // Synchronous counterpart to updateProgress — needed where the caller can't
  // await mid-transition (e.g. usePlanSession's drill-completion tick, which
  // must decide isNewBest before advancing the phase machine on the same
  // tick). MMKV is synchronous under the hood, so this is safe.
  updateProgressSync(moveId: string, score: number): boolean {
    const all = this.loadAllProgress();
    const existing = all[moveId];
    const isNewBest = score > (existing?.bestScore ?? 0);
    const bestScore = Math.max(score, existing?.bestScore ?? 0);
    all[moveId] = {
      moveId,
      bestScore,
      attempts: (existing?.attempts ?? 0) + 1,
      lastPracticed: Date.now(),
      mastered: bestScore >= 90,
    };
    mmkvStorage.set(STORAGE_KEYS.PROGRESS_DATA, all);
    return isNewBest;
  }

  private loadAllProgress(): Record<string, MoveProgress> {
    return mmkvStorage.get<Record<string, MoveProgress>>(STORAGE_KEYS.PROGRESS_DATA) ?? {};
  }
}

export const movesRepository = new MovesRepository();