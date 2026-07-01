import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/app/navigation/types';
import { colors } from '@/config/theme/colors';
import { STORAGE_KEYS } from '@/config/constants/app';
import { mmkvStorage } from '@/core/storage';
import { movesRepository } from '@/core/data/repositories/MovesRepository';
import { PracticeSession } from '@/features/practice/types/session.types';
import { MoveProgress } from '@/features/moves/types/move.types';
import { ProgressBar } from '../components/progress/ProgressBar';
import { useAppStore } from '@/core/state/store';

type TabPeriod = 'week' | 'month' | 'alltime';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BAR_TRACK_HEIGHT = 90;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

function avgScores(ss: PracticeSession[]): number {
  if (!ss.length) return 0;
  return Math.round(ss.reduce((a, s) => a + s.score, 0) / ss.length);
}

interface BarData {
  label: string;
  value: number; // 0-100
  isHighlight: boolean;
}

function buildBarData(sessions: PracticeSession[], tab: TabPeriod): BarData[] {
  const now = Date.now();
  const todayDow = new Date().getDay();

  if (tab === 'week') {
    return DAY_LABELS.map((label, i) => {
      const daySessions = sessions.filter(s => {
        const d = new Date(s.startTime);
        return d.getDay() === i && now - s.startTime < WEEK_MS;
      });
      return { label, value: avgScores(daySessions), isHighlight: i === todayDow };
    });
  }

  if (tab === 'month') {
    return ['W1', 'W2', 'W3', 'W4'].map((label, weekIndex) => {
      const weeksAgo = 3 - weekIndex;
      const weekEnd = now - weeksAgo * WEEK_MS;
      const weekStart = weekEnd - WEEK_MS;
      const weekSessions = sessions.filter(s => s.startTime >= weekStart && s.startTime < weekEnd);
      return { label, value: avgScores(weekSessions), isHighlight: weekIndex === 3 };
    });
  }

  // alltime: last 6 calendar months
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const year = d.getFullYear();
    const month = d.getMonth();
    const monthSessions = sessions.filter(s => {
      const sd = new Date(s.startTime);
      return sd.getFullYear() === year && sd.getMonth() === month;
    });
    return {
      label: MONTH_LABELS[month][0],
      value: avgScores(monthSessions),
      isHighlight: i === 5,
    };
  });
}

function masteryColor(score: number): string {
  if (score >= 80) return colors.primary[500];
  if (score >= 60) return '#E0C81F';
  return colors.secondary[500];
}

export const ProgressScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const userName = useAppStore(state => state.userName);
  const [tab, setTab] = useState<TabPeriod>('week');
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [allProgress, setAllProgress] = useState<MoveProgress[]>([]);
  const [moveNames, setMoveNames] = useState<Record<string, string>>({});
  const [streak, setStreak] = useState(0);

  useFocusEffect(useCallback(() => {
    const stored = mmkvStorage.get<PracticeSession[]>(STORAGE_KEYS.SESSIONS) ?? [];
    setSessions(stored);

    const daySet = new Set(stored.map(s => new Date(s.startTime).toDateString()));
    let streakCount = 0;
    const now = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      if (daySet.has(d.toDateString())) streakCount++;
      else if (i > 0) break;
    }
    setStreak(streakCount);

    movesRepository.getAllProgress().then(progress => {
      setAllProgress(progress);
      return movesRepository.getAll();
    }).then(moves => {
      const names: Record<string, string> = {};
      moves.forEach(m => { names[m.id] = m.name; });
      setMoveNames(names);
    });
  }, []));

  const stats = useMemo(() => {
    const now = Date.now();
    const windowMs = tab === 'week' ? WEEK_MS : tab === 'month' ? MONTH_MS : Infinity;

    const filtered = tab === 'alltime'
      ? sessions
      : sessions.filter(s => now - s.startTime < windowMs);

    const avgAccuracy = avgScores(filtered);

    let delta: number | null = null;
    if (tab !== 'alltime') {
      const prev = sessions.filter(s => now - s.startTime >= windowMs && now - s.startTime < 2 * windowMs);
      if (prev.length > 0) delta = avgAccuracy - avgScores(prev);
    }

    const totalPracticeMs = filtered.reduce((a, s) => a + Math.max(0, s.endTime - s.startTime), 0);

    return {
      avgAccuracy,
      delta,
      practiceTime: formatDuration(totalPracticeMs),
      totalHits: filtered.reduce((a, s) => a + (s.repsCompleted ?? 0), 0),
      sessionsDone: filtered.length,
      calories: Math.round(totalPracticeMs / 60000 * 5),
    };
  }, [sessions, tab]);

  const barData = useMemo(() => buildBarData(sessions, tab), [sessions, tab]);

  const sortedMastery = useMemo(
    () => [...allProgress].sort((a, b) => b.bestScore - a.bestScore),
    [allProgress],
  );

  const displayName = userName ?? 'Dancer';
  const initial = displayName.charAt(0).toUpperCase();

  const sectionPeriodLabel = tab === 'week' ? 'This week' : tab === 'month' ? 'This month' : 'All time';

  const deltaLabel =
    stats.delta === null ? null
    : stats.delta >= 0 ? `↑ ${stats.delta}%`
    : `↓ ${Math.abs(stats.delta)}%`;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <Text style={styles.title}>Progress</Text>
        </View>

        {/* Profile Identity */}
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileTagline}>Dance Frame Member</Text>
          </View>
          {streak > 0 && (
            <TouchableOpacity onPress={() => navigation.navigate('Streak')} style={styles.streakPill} activeOpacity={0.8}>
              <Text style={styles.streakPillText}>🔥 {streak}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.tabRow}>
          {(['week', 'month', 'alltime'] as TabPeriod[]).map(t => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, t === tab && styles.tabActive]}
            >
              <Text style={[styles.tabLabel, t === tab && styles.tabLabelActive]}>
                {t === 'week' ? 'Week' : t === 'month' ? 'Month' : 'All time'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.chartCard}>
          <View style={styles.chartTop}>
            <View>
              <Text style={styles.chartNum}>{stats.avgAccuracy}%</Text>
              <Text style={styles.chartSubLabel}>Avg. hit accuracy</Text>
            </View>
            {deltaLabel !== null && (
              <View style={styles.deltaBadge}>
                <Text style={styles.deltaText}>{deltaLabel}</Text>
              </View>
            )}
          </View>

          <View style={styles.barsChart}>
            {barData.map((bar, i) => {
              const barH = Math.round((bar.value / 100) * BAR_TRACK_HEIGHT);
              return (
                <View key={i} style={styles.barCol}>
                  <View style={styles.barTrack}>
                    {bar.isHighlight && barH > 0 ? (
                      <LinearGradient
                        colors={[colors.primary[500], '#0d8a7a']}
                        style={[styles.barFill, { height: barH }]}
                      />
                    ) : (
                      <View style={[styles.barFill, styles.barFillDim, { height: Math.max(barH, 0) }]} />
                    )}
                  </View>
                  <Text style={styles.barDay}>{bar.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <Text style={styles.sectionLabel}>{sectionPeriodLabel}</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>⏱️</Text>
            <Text style={styles.statNum}>{stats.practiceTime || '0m'}</Text>
            <Text style={styles.statLabel}>Practice time</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>🎯</Text>
            <Text style={styles.statNum}>{stats.totalHits}</Text>
            <Text style={styles.statLabel}>Hits landed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>✅</Text>
            <Text style={styles.statNum}>{stats.sessionsDone}</Text>
            <Text style={styles.statLabel}>Sessions done</Text>
          </View>
          <Pressable style={styles.statCard} onPress={() => navigation.navigate('Calories')}>
            <Text style={styles.statIcon}>🔥</Text>
            <Text style={styles.statNum}>{stats.calories}</Text>
            <Text style={styles.statLabel}>Calories burned</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Move mastery</Text>
        {sortedMastery.length > 0 ? (
          sortedMastery.map(p => (
            <View key={p.moveId} style={styles.masteryRow}>
              <View style={styles.masteryTop}>
                <Text style={styles.masteryName} numberOfLines={1}>
                  {moveNames[p.moveId] ?? p.moveId}
                </Text>
                <Text style={styles.masteryPct}>{p.bestScore}%</Text>
              </View>
              <ProgressBar
                progress={p.bestScore}
                height={6}
                color={masteryColor(p.bestScore)}
                backgroundColor={colors.gray[700]}
              />
            </View>
          ))
        ) : (
          <View style={styles.masteryRow}>
            <Text style={styles.emptyText}>Complete your first practice session</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: 110 },

  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6 },
  title: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: colors.text,
  },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 14,
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 20, fontWeight: '800', color: '#062420' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 17, fontWeight: '900', color: colors.text },
  profileTagline: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', marginTop: 2 },
  streakPill: {
    backgroundColor: colors.coralTint,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  streakPillText: { fontSize: 13, fontWeight: '800', color: colors.secondary[500] },

  tabRow: { flexDirection: 'row', gap: 8, marginHorizontal: 20, marginTop: 18 },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, backgroundColor: colors.gray[700] },
  tabActive: { backgroundColor: colors.primary[500] },
  tabLabel: { fontSize: 12.5, fontWeight: '700', color: colors.textSecondary },
  tabLabelActive: { color: '#06201D' },

  chartCard: {
    marginHorizontal: 20,
    marginTop: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 20,
  },
  chartTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  chartNum: { fontSize: 34, fontWeight: '900', color: colors.text, letterSpacing: -0.8, lineHeight: 36 },
  chartSubLabel: { fontSize: 11.5, color: colors.textSecondary, fontWeight: '600', marginTop: 4 },
  deltaBadge: {
    backgroundColor: 'rgba(31,224,201,0.16)',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 8,
  },
  deltaText: { fontSize: 12, fontWeight: '800', color: colors.primary[500] },

  barsChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 110,
    gap: 8,
  },
  barCol: { flex: 1, alignItems: 'center', gap: 8 },
  barTrack: { width: '100%', height: BAR_TRACK_HEIGHT, justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 6 },
  barFillDim: { backgroundColor: colors.gray[700] },
  barDay: { fontSize: 10, color: colors.textSecondary, fontWeight: '700' },

  sectionLabel: {
    marginHorizontal: 20,
    marginTop: 28,
    marginBottom: 12,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    fontWeight: '700',
  },

  statsGrid: { marginHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '47.5%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
  },
  statIcon: { fontSize: 18, marginBottom: 10 },
  statNum: { fontSize: 22, fontWeight: '900', color: colors.text, letterSpacing: -0.3 },
  statLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', marginTop: 2 },

  masteryRow: {
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    paddingHorizontal: 16,
  },
  masteryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  masteryName: { fontSize: 13.5, fontWeight: '700', color: colors.text, flex: 1, marginRight: 8 },
  masteryPct: { fontSize: 13, fontWeight: '800', color: colors.text },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', paddingVertical: 4 },
});
