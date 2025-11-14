import { useEffect, useState } from 'react';
import { movesRepository } from '@/core/data/repositories/MovesRepository';
import { Move } from '../types/move.types';
import { logger } from '@/shared/utils/logger';

export const useMoves = () => {
  const [moves, setMoves] = useState<Move[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMoves();
  }, []);

  const loadMoves = async () => {
    try {
      setLoading(true);
      const allMoves = await movesRepository.getAll();
      setMoves(allMoves);
      setError(null);
    } catch (err) {
      logger.error('Failed to load moves:', err);
      setError('Failed to load moves');
    } finally {
      setLoading(false);
    }
  };

  const getMovesByDifficulty = async (difficulty: string) => {
    try {
      const filtered = await movesRepository.getMovesByDifficulty(difficulty);
      setMoves(filtered);
    } catch (err) {
      logger.error('Failed to filter moves:', err);
    }
  };

  return {
    moves,
    loading,
    error,
    refresh: loadMoves,
    filterByDifficulty: getMovesByDifficulty,
  };
};