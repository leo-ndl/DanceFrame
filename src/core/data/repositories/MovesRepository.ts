import { Move, MoveProgress } from '@/features/moves/types/move.types';
import { LocalDataSource } from '@/core/data/sources/local/LocalMovesDataSource';
import { movesData } from '@/features/moves/data/movesData';
import { STORAGE_KEYS } from '@/config/constants/app';
import { mmkvStorage } from '@/core/storage';
import { generateId } from '@/shared/utils/helper';
import { ImportedMoveData } from '@/features/import/services/VideoPoseExtractor';

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

  async getImportedMoves(): Promise<Move[]> {
    const all = await this.getAll();
    return all.filter(m => m.isImported === true);
  }

  async saveImportedMove(data: ImportedMoveData, name: string): Promise<Move> {
    const move: Move = {
      id: `imported-${generateId()}`,
      name,
      difficulty: 'Intermediate',
      description: 'Imported from video',
      videoUrl: data.videoUri,
      keyPoints: [],
      // Teaching poses (backward compat for PracticeScreen)
      referencePoses: data.poses,
      duration: Math.round(data.durationMs / 1000),
      bpm: 120,
      importedVideoUri: data.videoUri,
      importedAt: Date.now(),
      isImported: true,
      motionRepresentation: data.motionRepresentation,
    };
    await this.localSource.save(move);
    return move;
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

  private loadAllProgress(): Record<string, MoveProgress> {
    return mmkvStorage.get<Record<string, MoveProgress>>(STORAGE_KEYS.PROGRESS_DATA) ?? {};
  }
}

export const movesRepository = new MovesRepository();