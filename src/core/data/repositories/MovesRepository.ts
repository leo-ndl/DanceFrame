import { Move } from '@/features/moves/types/move.types';
import { LocalDataSource } from '@/core/data/sources/local/LocalMovesDataSource';
import { movesData } from '@/features/moves/data/movesData';
import { STORAGE_KEYS } from '@/config/constants/app';

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
    // Will implement progress tracking
  }
}

export const movesRepository = new MovesRepository();