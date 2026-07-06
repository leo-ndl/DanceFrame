import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/app/navigation/types';
import { colors } from '@/config/theme/colors';
import { movesRepository } from '@/core/data/repositories/MovesRepository';
import { Move, MoveProgress } from '@/features/moves/types/move.types';
import { mmkvStorage } from '@/core/storage';
import { STORAGE_KEYS } from '@/config/constants/app';
import { PracticeSession } from '@/features/practice/types/session.types';
import { formatTime } from '@/shared/utils/helper';
import { useAppStore } from '@/core/state/store';
import { DaySession } from '@/features/training/types/training.types';

// Heights for the 5-bar sparklines (static representative shape)
const SPARKLINE_HEIGHTS = [8, 12, 9, 16, 14];

export const DashboardScreen = () => {
  const [moves, setMoves] = useState<Move[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, MoveProgress>>({});
  const [totalPracticeMs, setTotalPracticeMs] = useState(0);
  const [streak, setStreak] = useState(0);
  const [sessions, setSessions] = useState<PracticeSession[]>([]);

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const activePlan = useAppStore(state => state.activePlan);
  const userName = useAppStore(state => state.userName);

  const todayDayNumber = useMemo(() => {
    if (!activePlan) return null;
    return Math.min(Math.floor((Date.now() - activePlan.startDate) / 86400000) + 1, 30);
  }, [activePlan]);

  const todaySession = useMemo((): DaySession | null => {
    if (!activePlan || todayDayNumber === null) return null;
    return activePlan.sessions.find(s => s.dayNumber === todayDayNumber) ?? null;
  }, [activePlan, todayDayNumber]);

  const loadData = useCallback(async () => {
    const [allMoves, allProgress] = await Promise.all([
      movesRepository.getAll(),
      movesRepository.getAllProgress(),
    ]);

    const pMap: Record<string, MoveProgress> = {};
    allProgress.forEach(p => { pMap[p.moveId] = p; });

    setMoves(allMoves);
    setProgressMap(pMap);

    const rawSessions = mmkvStorage.get<PracticeSession[]>(STORAGE_KEYS.SESSIONS) ?? [];
    setSessions(rawSessions);

    const totalMs = rawSessions.reduce((acc, s) => acc + (s.endTime - s.startTime), 0);
    setTotalPracticeMs(totalMs);

    const daySet = new Set(rawSessions.map(s => new Date(s.startTime).toDateString()));
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

  // Boolean array: last 7 days (oldest→newest), true if session existed that day
  const last7Days = useMemo((): boolean[] => {
    const daySet = new Set(sessions.map(s => new Date(s.startTime).toDateString()));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return daySet.has(d.toDateString());
    });
  }, [sessions]);

  // Average accuracy score from last 7 days' sessions
  const weeklyAccuracy = useMemo((): number | null => {
    const cutoff = Date.now() - 7 * 86400000;
    const recent = sessions.filter(s => s.startTime >= cutoff);
    if (!recent.length) return null;
    return Math.round(recent.reduce((sum, s) => sum + s.score, 0) / recent.length);
  }, [sessions]);

  // Moves with recorded progress and bestScore < 80, sorted by score ascending
  const needsWorkMoves = useMemo(() => {
    return Object.entries(progressMap)
      .filter(([, p]) => p.bestScore > 0 && p.bestScore < 80)
      .map(([id, p]) => ({ move: moves.find(m => m.id === id), progress: p }))
      .filter((x): x is { move: Move; progress: MoveProgress } => !!x.move)
      .sort((a, b) => a.progress.bestScore - b.progress.bestScore)
      .slice(0, 5);
  }, [progressMap, moves]);

  const sessionTitle = useMemo(() => {
    if (!todaySession) return null;
    if (todaySession.isRestDay) return 'Rest & Recovery';
    return todaySession.drills.slice(0, 2).map(d => d.name).join(' & ');
  }, [todaySession]);

  const totalSessionMinutes = useMemo(() => {
    if (!todaySession) return 0;
    const secs = todaySession.drills.reduce((s, d) => s + d.durationSeconds + d.breakSeconds, 0);
    return Math.max(1, Math.ceil(secs / 60));
  }, [todaySession]);

  const displayName = userName ?? 'Dancer';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Hey, {displayName}</Text>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
        </View>

        {/* Streak Row */}
        {streak > 0 && (
          <TouchableOpacity
            style={styles.streakRow}
            onPress={() => navigation.navigate('Streak')}
            activeOpacity={0.8}
          >
            <View style={styles.streakFlame}>
              <Text style={styles.streakFlameEmoji}>🔥</Text>
            </View>
            <View style={styles.streakText}>
              <Text style={styles.streakNum}>{streak}-day streak</Text>
              <Text style={styles.streakSub}>Practice today to keep it alive</Text>
            </View>
            <View style={styles.streakBars}>
              {last7Days.map((active, i) => (
                <View
                  key={i}
                  style={[
                    styles.streakBar,
                    { height: 8 + (i % 3) * 5 },
                    active ? styles.streakBarActive : styles.streakBarOff,
                  ]}
                />
              ))}
            </View>
          </TouchableOpacity>
        )}

        {/* Today's Session */}
        <Text style={styles.sectionLabel}>Today's session</Text>

        {!activePlan ? (
          <TouchableOpacity
            style={styles.planCta}
            onPress={() => navigation.navigate('GoalSetup')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#0f2422', colors.surface]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.planCtaGradient}
            >
              <Text style={styles.sessionEyebrow}>GET STARTED</Text>
              <Text style={styles.sessionTitle}>Start Your 30-Day Journey</Text>
              <Text style={styles.sessionMeta}>Popping · Hip-Hop · Locking · and more</Text>
              <View style={styles.startBtn}>
                <Text style={styles.startBtnText}>Create My Plan</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            activeOpacity={0.95}
            onPress={() =>
              todayDayNumber !== null &&
              navigation.navigate('DaySessionDetail', { dayNumber: todayDayNumber })
            }
          >
            <LinearGradient
              colors={['#0f2422', colors.surface]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sessionCard}
            >
              {/* Radial glow accent */}
              <View style={styles.sessionGlow} />

              <Text style={styles.sessionEyebrow}>
                {activePlan.danceStyle.toUpperCase()} · {activePlan.level.toUpperCase()}
              </Text>
              <Text style={styles.sessionTitle}>{sessionTitle}</Text>
              <Text style={styles.sessionMeta}>
                {todaySession?.isRestDay
                  ? 'Rest day · Recovery'
                  : `${todaySession?.drills.length ?? 0} moves · ${totalSessionMinutes} min · ${activePlan.level}`}
              </Text>

              {/* Move thumbnails */}
              {!todaySession?.isRestDay && (
                <View style={styles.moveThumbs}>
                  {Array.from({ length: Math.min(todaySession?.drills.length ?? 0, 5) }).map((_, i) => (
                    <View key={i} style={styles.moveThumb} />
                  ))}
                </View>
              )}

              <View style={styles.startBtn}>
                <Text style={styles.startBtnText}>Start Session</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>🎯</Text>
            <Text style={styles.statNum}>
              {weeklyAccuracy !== null ? `${weeklyAccuracy}%` : '—'}
            </Text>
            <Text style={styles.statLabel}>Hit accuracy this week</Text>
            <View style={styles.sparkline}>
              {SPARKLINE_HEIGHTS.map((h, i) => (
                <View
                  key={i}
                  style={[
                    styles.sparkBar,
                    { height: h },
                    i < 2 ? styles.sparkBarLow : styles.sparkBarHigh,
                  ]}
                />
              ))}
            </View>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statIcon}>⏱</Text>
            <Text style={styles.statNum}>
              {totalPracticeMs > 0 ? formatTime(Math.round(totalPracticeMs / 1000)) : '—'}
            </Text>
            <Text style={styles.statLabel}>Total practice time</Text>
            <View style={styles.sparkline}>
              {[8, 12, 9, 14, 11].map((h, i) => (
                <View key={i} style={[styles.sparkBar, styles.sparkBarHigh, { height: h }]} />
              ))}
            </View>
          </View>
        </View>

        {/* Needs Work */}
        {needsWorkMoves.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Needs work</Text>
            {needsWorkMoves.map(({ move, progress }) => (
              <TouchableOpacity
                key={move.id}
                style={styles.drillRow}
                onPress={() => navigation.navigate('Practice', { moveId: move.id })}
                activeOpacity={0.8}
              >
                <View style={styles.drillThumb} />
                <View style={styles.drillInfo}>
                  <Text style={styles.drillName}>{move.name}</Text>
                  <Text style={styles.drillMeta}>
                    Practiced {progress.attempts} time{progress.attempts !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={styles.drillScoreBadge}>
                  <Text style={styles.drillScoreText}>{progress.bestScore}%</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 100 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
    marginBottom: 4,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: colors.text,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 15, fontWeight: '800', color: '#062420' },

  // Streak Row
  streakRow: {
    marginHorizontal: 20,
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
  },
  streakFlame: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.coralTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakFlameEmoji: { fontSize: 18 },
  streakText: { flex: 1 },
  streakNum: { fontSize: 15, fontWeight: '800', color: colors.text },
  streakSub: { fontSize: 11, color: colors.textSecondary, fontWeight: '500', marginTop: 1 },
  streakBars: { flexDirection: 'row', gap: 3, alignItems: 'flex-end', height: 22 },
  streakBar: { width: 4, borderRadius: 2 },
  streakBarActive: { backgroundColor: colors.secondary[500] },
  streakBarOff: { backgroundColor: 'rgba(236,239,238,0.15)' },

  // Section Label
  sectionLabel: {
    marginHorizontal: 20,
    marginTop: 26,
    marginBottom: 12,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    fontWeight: '700',
  },

  // Plan CTA (no active plan)
  planCta: {
    marginHorizontal: 20,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(31,224,201,0.28)',
  },
  planCtaGradient: { padding: 22 },

  // Session Card (active plan)
  sessionCard: {
    marginHorizontal: 20,
    borderRadius: 22,
    padding: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(31,224,201,0.28)',
    position: 'relative',
  },
  sessionGlow: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(31,224,201,0.12)',
  },
  sessionEyebrow: {
    fontSize: 11,
    letterSpacing: 1,
    color: colors.primary[500],
    fontWeight: '800',
    marginBottom: 8,
  },
  sessionTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: colors.text,
    marginBottom: 6,
    maxWidth: 240,
    lineHeight: 26,
  },
  sessionMeta: {
    fontSize: 12.5,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: 16,
  },
  moveThumbs: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  moveThumb: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  startBtn: {
    backgroundColor: colors.primary[500],
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: colors.primary[500],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  startBtnText: { color: '#062420', fontWeight: '800', fontSize: 15 },

  // Stats Grid
  statsGrid: {
    marginHorizontal: 20,
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
  },
  statIcon: { fontSize: 18, marginBottom: 10 },
  statNum: { fontSize: 22, fontWeight: '900', color: colors.text, letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', marginTop: 2 },
  sparkline: { flexDirection: 'row', gap: 3, alignItems: 'flex-end', height: 18, marginTop: 10 },
  sparkBar: { width: 5, borderRadius: 2 },
  sparkBarHigh: { backgroundColor: colors.primary[500] },
  sparkBarLow: { backgroundColor: 'rgba(31,224,201,0.3)' },

  // Needs Work
  drillRow: {
    marginHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    marginBottom: 10,
  },
  drillThumb: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.surface2,
    flexShrink: 0,
  },
  drillInfo: { flex: 1 },
  drillName: { fontSize: 14, fontWeight: '700', color: colors.text },
  drillMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  drillScoreBadge: {
    backgroundColor: colors.coralTint,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 9,
  },
  drillScoreText: { fontSize: 11, fontWeight: '800', color: colors.secondary[500] },
});
