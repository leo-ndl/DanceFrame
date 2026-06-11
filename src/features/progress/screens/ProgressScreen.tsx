import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { theme } from '@/config/theme';
import { colors } from '@/config/theme/colors';
import { Card } from '@/shared/components/cards/Card';
import { ProgressBar } from '../components/progress/ProgressBar';
import { movesRepository } from '@/core/data/repositories/MovesRepository';
import { mmkvStorage } from '@/core/storage';
import { STORAGE_KEYS } from '@/config/constants/app';
import { PracticeSession } from '@/features/practice/types/session.types';
import { MoveProgress } from '@/features/moves/types/move.types';

interface DayStat {
  label: string;
  count: number;
}

function buildWeeklyActivity(sessions: PracticeSession[]): DayStat[] {
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const counts: Record<number, number> = {};
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.getDay();
    counts[key] = 0;
  }

  sessions.forEach(s => {
    const d = new Date(s.startTime);
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 7 * 24 * 60 * 60 * 1000) {
      counts[d.getDay()] = (counts[d.getDay()] ?? 0) + 1;
    }
  });

  return Object.entries(counts).map(([day, count]) => ({
    label: dayLabels[Number(day)],
    count,
  }));
}

const MILESTONES = [
  { id: 'first_session',  label: 'First Practice',       emoji: '🎯', check: (s: PracticeSession[], _p: MoveProgress[]) => s.length >= 1 },
  { id: 'score_90',       label: 'Score 90%+',           emoji: '🔥', check: (s: PracticeSession[], _p: MoveProgress[]) => s.some(x => x.score >= 90) },
  { id: 'ten_sessions',   label: '10 Sessions',          emoji: '💪', check: (s: PracticeSession[], _p: MoveProgress[]) => s.length >= 10 },
  { id: 'three_moves',    label: 'Practice 3 Moves',     emoji: '🕺', check: (_s: PracticeSession[], p: MoveProgress[]) => p.length >= 3 },
  { id: 'mastered_one',   label: 'Master a Move (90%+)', emoji: '🏆', check: (_s: PracticeSession[], p: MoveProgress[]) => p.some(x => x.mastered) },
];

export const ProgressScreen = () => {
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [allProgress, setAllProgress] = useState<MoveProgress[]>([]);
  const [moveNames, setMoveNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const stored = mmkvStorage.get<PracticeSession[]>(STORAGE_KEYS.SESSIONS) ?? [];
    setSessions(stored);

    movesRepository.getAllProgress().then(progress => {
      setAllProgress(progress);
      return movesRepository.getAll();
    }).then(moves => {
      const names: Record<string, string> = {};
      moves.forEach(m => { names[m.id] = m.name; });
      setMoveNames(names);
    });
  }, []);

  const weeklyActivity = buildWeeklyActivity(sessions);
  const maxActivity = Math.max(...weeklyActivity.map(d => d.count), 1);

  const totalSessions = sessions.length;
  const avgScore = totalSessions > 0
    ? Math.round(sessions.reduce((a, s) => a + s.score, 0) / totalSessions)
    : 0;
  const bestScore = totalSessions > 0 ? Math.max(...sessions.map(s => s.score)) : 0;

  const hasData = totalSessions > 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Your Progress</Text>

        {/* Summary stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'Sessions', value: totalSessions.toString() },
            { label: 'Avg Score', value: hasData ? `${avgScore}%` : '—' },
            { label: 'Best', value: hasData ? `${bestScore}%` : '—' },
          ].map(stat => (
            <Card key={stat.label} style={styles.statCard}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </Card>
          ))}
        </View>

        {/* Weekly activity heatmap */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>This Week</Text>
          {hasData ? (
            <View style={styles.heatmap}>
              {weeklyActivity.map(day => (
                <View key={day.label} style={styles.heatmapCol}>
                  <View style={styles.heatmapBarTrack}>
                    <View
                      style={[
                        styles.heatmapBarFill,
                        {
                          height: `${(day.count / maxActivity) * 100}%`,
                          backgroundColor: day.count > 0 ? colors.primary[500] : colors.gray[700],
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.heatmapLabel}>{day.label}</Text>
                  {day.count > 0 && (
                    <Text style={styles.heatmapCount}>{day.count}</Text>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>📊 Start practicing to see your activity</Text>
          )}
        </Card>

        {/* Per-move skills */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Skills Breakdown</Text>
          {allProgress.length > 0 ? (
            allProgress.map(p => (
              <View key={p.moveId} style={styles.skillRow}>
                <View style={styles.skillMeta}>
                  <Text style={styles.skillName} numberOfLines={1}>
                    {moveNames[p.moveId] ?? p.moveId}
                  </Text>
                  <Text style={styles.skillDetail}>
                    {p.attempts} session{p.attempts !== 1 ? 's' : ''}
                    {p.mastered ? '  🏆' : ''}
                  </Text>
                </View>
                <ProgressBar
                  progress={p.bestScore}
                  color={p.bestScore >= 80 ? colors.success : p.bestScore >= 60 ? colors.warning : colors.error}
                  style={styles.progressBar}
                />
                <Text style={styles.skillScore}>{p.bestScore}%</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>💪 Complete your first practice session</Text>
          )}
        </Card>

        {/* Milestones */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Milestones</Text>
          {MILESTONES.map(m => {
            const achieved = m.check(sessions, allProgress);
            return (
              <View key={m.id} style={[styles.milestone, !achieved && styles.milestoneGray]}>
                <Text style={styles.milestoneEmoji}>{m.emoji}</Text>
                <Text style={[styles.milestoneLabel, !achieved && { color: colors.gray[600] }]}>
                  {m.label}
                </Text>
                {achieved && <Text style={styles.milestoneDone}>✓</Text>}
              </View>
            );
          })}
        </Card>

        {/* Recent sessions */}
        {sessions.length > 0 && (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Recent Sessions</Text>
            {sessions.slice(0, 5).map(s => (
              <View key={s.id} style={styles.sessionRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sessionMove}>{moveNames[s.moveId] ?? s.moveId}</Text>
                  <Text style={styles.sessionDate}>
                    {new Date(s.startTime).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={[styles.sessionScore, { color: s.score >= 80 ? colors.success : s.score >= 60 ? colors.warning : colors.error }]}>
                  {s.score}%
                </Text>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: 40 },
  title: {
    fontSize: theme.typography.fontSize['3xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
  statsRow: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  statCard: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: theme.typography.fontSize['2xl'], fontWeight: theme.typography.fontWeight.bold, color: theme.colors.text },
  statLabel: { fontSize: theme.typography.fontSize.xs, color: theme.colors.textSecondary, marginTop: 2 },
  card: { marginBottom: theme.spacing.md },
  cardTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  emptyText: { fontSize: theme.typography.fontSize.base, color: theme.colors.textSecondary, textAlign: 'center', paddingVertical: theme.spacing.xl },
  heatmap: { flexDirection: 'row', justifyContent: 'space-between', height: 80, alignItems: 'flex-end' },
  heatmapCol: { flex: 1, alignItems: 'center', gap: 4 },
  heatmapBarTrack: { width: 24, height: 56, backgroundColor: colors.gray[800], borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' },
  heatmapBarFill: { width: '100%', borderRadius: 4, minHeight: 4 },
  heatmapLabel: { color: colors.gray[500], fontSize: 9, fontWeight: '600' },
  heatmapCount: { color: colors.primary[400], fontSize: 9, fontWeight: '700' },
  skillRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm, gap: theme.spacing.sm },
  skillMeta: { width: 90 },
  skillName: { color: theme.colors.text, fontSize: theme.typography.fontSize.xs, fontWeight: '600' },
  skillDetail: { color: theme.colors.textSecondary, fontSize: 10, marginTop: 1 },
  progressBar: { flex: 1 },
  skillScore: { color: theme.colors.text, fontSize: theme.typography.fontSize.xs, fontWeight: '700', width: 30, textAlign: 'right' },
  milestone: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  milestoneGray: { opacity: 0.4 },
  milestoneEmoji: { fontSize: 20, marginRight: theme.spacing.sm },
  milestoneLabel: { flex: 1, color: theme.colors.text, fontSize: theme.typography.fontSize.sm },
  milestoneDone: { color: colors.success, fontWeight: '700', fontSize: theme.typography.fontSize.base },
  sessionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  sessionMove: { color: theme.colors.text, fontSize: theme.typography.fontSize.sm, fontWeight: '600' },
  sessionDate: { color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.xs, marginTop: 2 },
  sessionScore: { fontSize: theme.typography.fontSize.lg, fontWeight: '700' },
});
