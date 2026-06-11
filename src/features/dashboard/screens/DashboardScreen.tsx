import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/app/navigation/types';
import { theme } from '@/config/theme';
import { Card } from '@/shared/components/cards/Card';
import { Button } from '@/shared/components/buttons/Button';
import { movesRepository } from '@/core/data/repositories/MovesRepository';
import { Move, MoveProgress } from '@/features/moves/types/move.types';
import { mmkvStorage } from '@/core/storage';
import { STORAGE_KEYS } from '@/config/constants/app';
import { PracticeSession } from '@/features/practice/types/session.types';
import { formatTime } from '@/shared/utils/helper';
import { colors } from '@/config/theme/colors';

export const DashboardScreen = () => {
  const [moves, setMoves] = useState<Move[]>([]);
  const [importedMoves, setImportedMoves] = useState<Move[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, MoveProgress>>({});
  const [totalPracticeMs, setTotalPracticeMs] = useState(0);
  const [streak, setStreak] = useState(0);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  const loadData = useCallback(async () => {
    const [allMoves, allProgress] = await Promise.all([
      movesRepository.getAll(),
      movesRepository.getAllProgress(),
    ]);

    const builtIn = allMoves.filter(m => !m.isImported);
    const imported = allMoves.filter(m => m.isImported);
    const pMap: Record<string, MoveProgress> = {};
    allProgress.forEach(p => { pMap[p.moveId] = p; });

    setMoves(builtIn);
    setImportedMoves(imported);
    setProgressMap(pMap);

    // Compute real stats from saved sessions.
    const sessions = mmkvStorage.get<PracticeSession[]>(STORAGE_KEYS.SESSIONS) ?? [];
    const totalMs = sessions.reduce((acc, s) => acc + (s.endTime - s.startTime), 0);
    setTotalPracticeMs(totalMs);

    // Streak: count consecutive days from today with at least one session.
    const daySet = new Set(sessions.map(s => new Date(s.startTime).toDateString()));
    let streakCount = 0;
    const now = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      if (daySet.has(d.toDateString())) streakCount++;
      else if (i > 0) break;
    }
    setStreak(streakCount);
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const navigate = useCallback((moveId: string) => {
    navigation.navigate('Practice', { moveId });
  }, [navigation]);

  const lastPracticedMove = moves.find(m => progressMap[m.id]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Dance Frame</Text>
            <Text style={styles.subtitle}>Your AI Dance Coach</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Practice Time</Text>
            <Text style={styles.statValue}>
              {totalPracticeMs > 0 ? formatTime(Math.round(totalPracticeMs / 1000)) : '—'}
            </Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Streak</Text>
            <Text style={styles.statValue}>
              {streak > 0 ? `${streak} day${streak !== 1 ? 's' : ''} 🔥` : '—'}
            </Text>
          </Card>
        </View>

        {/* Import CTA */}
        <TouchableOpacity
          style={styles.importBanner}
          onPress={() => navigation.navigate('VideoImport')}
        >
          <Text style={styles.importBannerEmoji}>🎬</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.importBannerTitle}>Import a TikTok Move</Text>
            <Text style={styles.importBannerSub}>Pick any video and practice it with AI coaching</Text>
          </View>
          <Text style={styles.importBannerArrow}>→</Text>
        </TouchableOpacity>

        {/* Continue card */}
        {lastPracticedMove && (
          <Card style={styles.continueCard}>
            <Text style={styles.continueLabel}>CONTINUE LEARNING</Text>
            <Text style={styles.continueTitle}>{lastPracticedMove.name}</Text>
            {progressMap[lastPracticedMove.id] && (
              <Text style={styles.continueSub}>
                Best: {progressMap[lastPracticedMove.id].bestScore}%  •  {progressMap[lastPracticedMove.id].attempts} attempt{progressMap[lastPracticedMove.id].attempts !== 1 ? 's' : ''}
              </Text>
            )}
            <Button
              title="Practice Now"
              onPress={() => navigate(lastPracticedMove.id)}
              style={styles.button}
            />
          </Card>
        )}

        {/* My Imported Moves */}
        {importedMoves.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Moves</Text>
            {importedMoves.map(move => (
              <TouchableOpacity key={move.id} onPress={() => navigate(move.id)}>
                <Card style={styles.moveCard}>
                  <View style={styles.moveCardRow}>
                    <Text style={styles.moveEmoji}>🎬</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.moveName}>{move.name}</Text>
                      <Text style={styles.moveDifficulty}>
                        {move.referencePoses.length} frames  •  {move.duration}s
                      </Text>
                    </View>
                    {progressMap[move.id] && (
                      <Text style={styles.moveScore}>{progressMap[move.id].bestScore}%</Text>
                    )}
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Built-in Moves Library */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Moves Library</Text>
          {moves.map(move => (
            <TouchableOpacity key={move.id} onPress={() => navigate(move.id)}>
              <Card style={styles.moveCard}>
                <View style={styles.moveCardRow}>
                  <Text style={styles.moveEmoji}>🕺</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.moveName}>{move.name}</Text>
                    <Text style={styles.moveDifficulty}>
                      {move.difficulty}  •  {move.bpm} BPM
                    </Text>
                  </View>
                  {progressMap[move.id] && (
                    <Text style={[styles.moveScore, { color: scoreColor(progressMap[move.id].bestScore) }]}>
                      {progressMap[move.id].bestScore}%
                    </Text>
                  )}
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

function scoreColor(score: number): string {
  if (score >= 80) return colors.success;
  if (score >= 60) return colors.warning;
  return colors.error;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  title: { fontSize: theme.typography.fontSize['4xl'], fontWeight: '700', color: theme.colors.text },
  subtitle: { fontSize: theme.typography.fontSize.base, color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
  statsGrid: { flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.lg },
  statCard: { flex: 1 },
  statLabel: { fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary, marginBottom: theme.spacing.xs },
  statValue: { fontSize: theme.typography.fontSize.xl, fontWeight: '700', color: theme.colors.text },
  importBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[800],
    borderRadius: 14,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: colors.primary[600],
  },
  importBannerEmoji: { fontSize: 28 },
  importBannerTitle: { color: theme.colors.text, fontWeight: '700', fontSize: theme.typography.fontSize.base },
  importBannerSub: { color: colors.primary[300], fontSize: theme.typography.fontSize.xs, marginTop: 2 },
  importBannerArrow: { color: colors.primary[400], fontSize: 20, fontWeight: '700' },
  continueCard: { backgroundColor: theme.colors.primary[600], marginBottom: theme.spacing.lg },
  continueLabel: { fontSize: theme.typography.fontSize.xs, color: theme.colors.primary[200], marginBottom: theme.spacing.xs },
  continueTitle: { fontSize: theme.typography.fontSize['2xl'], fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing.xs },
  continueSub: { fontSize: theme.typography.fontSize.xs, color: colors.primary[200], marginBottom: theme.spacing.sm },
  button: { marginTop: theme.spacing.sm },
  section: { marginBottom: theme.spacing.lg },
  sectionTitle: { fontSize: theme.typography.fontSize.lg, fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing.md },
  moveCard: { marginBottom: theme.spacing.md },
  moveCardRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  moveEmoji: { fontSize: 24, width: 32 },
  moveName: { fontSize: theme.typography.fontSize.base, fontWeight: '600', color: theme.colors.text },
  moveDifficulty: { fontSize: theme.typography.fontSize.xs, color: theme.colors.textSecondary, marginTop: 2 },
  moveScore: { fontSize: theme.typography.fontSize.base, fontWeight: '700', color: colors.success },
});
