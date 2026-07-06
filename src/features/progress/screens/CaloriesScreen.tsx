import React, { useCallback, useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '@/config/theme/colors';
import { STORAGE_KEYS } from '@/config/constants/app';
import { mmkvStorage } from '@/core/storage';
import { movesRepository } from '@/core/data/repositories/MovesRepository';
import { PracticeSession } from '@/features/practice/types/session.types';

interface Props {
  navigation: any;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const RING_R = 82;
const RING_CX = 95;
const RING_CY = 95;
const CIRC = 2 * Math.PI * RING_R; // ≈ 515.2
const WEEKLY_GOAL = 2000;

function sessionCal(s: PracticeSession): number {
  return Math.round(Math.max(0, s.endTime - s.startTime) / 60000 * 5);
}

function formatMins(ms: number): string {
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return h > 0 ? `${h}h ${String(rem).padStart(2, '0')}m` : `${m}m`;
}

function relativeDay(ts: number): string {
  const diffDays = Math.floor((Date.now() - ts) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(ts).getDay()];
}

const SESSION_ICONS = ['🔥', '💃', '⚡', '🎯', '💪', '🌟', '🕺'];
function sessionIcon(moveId: string): string {
  let hash = 0;
  for (let i = 0; i < moveId.length; i++) hash = (hash * 31 + moveId.charCodeAt(i)) & 0xffff;
  return SESSION_ICONS[hash % SESSION_ICONS.length];
}

export const CaloriesScreen: React.FC<Props> = ({ navigation }) => {
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [moveNames, setMoveNames] = useState<Record<string, string>>({});

  useFocusEffect(useCallback(() => {
    const stored = mmkvStorage.get<PracticeSession[]>(STORAGE_KEYS.SESSIONS) ?? [];
    setSessions(stored);
    movesRepository.getAll().then(moves => {
      const names: Record<string, string> = {};
      moves.forEach(m => { names[m.id] = m.name; });
      setMoveNames(names);
    });
  }, []));

  const now = Date.now();

  const weekSessions = useMemo(
    () => sessions.filter(s => now - s.startTime < WEEK_MS),
    [sessions],
  );

  const totalCalories = useMemo(
    () => weekSessions.reduce((a, s) => a + sessionCal(s), 0),
    [weekSessions],
  );

  const totalPracticeMs = useMemo(
    () => weekSessions.reduce((a, s) => a + Math.max(0, s.endTime - s.startTime), 0),
    [weekSessions],
  );

  const vsLastWeek = useMemo(() => {
    const prevCal = sessions
      .filter(s => now - s.startTime >= WEEK_MS && now - s.startTime < 2 * WEEK_MS)
      .reduce((a, s) => a + sessionCal(s), 0);
    if (prevCal === 0) return null;
    return Math.round(((totalCalories - prevCal) / prevCal) * 100);
  }, [sessions, totalCalories]);

  // Per-day calories for the last 7 days (ordered oldest → newest, matching S M T W T F S)
  const weekChips = useMemo(() => {
    return DAY_INITIALS.map((label, dow) => {
      const dayCal = weekSessions
        .filter(s => new Date(s.startTime).getDay() === dow)
        .reduce((a, s) => a + sessionCal(s), 0);
      return { label, cal: dayCal, active: dayCal > 0 };
    });
  }, [weekSessions]);

  // Ring fill
  const ratio = Math.min(totalCalories / WEEKLY_GOAL, 1);
  const dashOffset = CIRC * (1 - ratio);

  const vsLabel = vsLastWeek === null ? null
    : vsLastWeek >= 0 ? `+${vsLastWeek}%`
    : `${vsLastWeek}%`;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backChevron}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>Calories</Text>
          <View style={styles.topSpacer} />
        </View>
        <View style={styles.heroHead}>
          <Text style={styles.eyebrow}>Energy burned</Text>
          <Text style={styles.title}>This Week</Text>
        </View>

        {/* Ring card */}
        <View style={styles.ringCard}>
          <View style={styles.ringWrap}>
            <Svg width={190} height={190} viewBox="0 0 190 190">
              <Circle
                cx={RING_CX}
                cy={RING_CY}
                r={RING_R}
                fill="none"
                stroke={colors.gray[700]}
                strokeWidth={14}
              />
              <Circle
                cx={RING_CX}
                cy={RING_CY}
                r={RING_R}
                fill="none"
                stroke={colors.secondary[500]}
                strokeWidth={14}
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${RING_CX} ${RING_CY})`}
              />
            </Svg>
            <View style={styles.ringCenter}>
              <Text style={styles.ringNum}>{totalCalories.toLocaleString()}</Text>
              <Text style={styles.ringUnit}>CALORIES BURNED</Text>
            </View>
          </View>

          <Text style={styles.ringSub}>
            {`From ${weekSessions.length} dance session${weekSessions.length !== 1 ? 's' : ''} this week — driven by your movement, not a target to hit.`}
          </Text>

          <View style={styles.weekChipRow}>
            {weekChips.map((chip, i) => (
              <View key={i} style={[styles.weekChip, chip.active && styles.weekChipActive]}>
                <Text style={[styles.weekChipLabel, chip.active && styles.weekChipLabelActive]}>
                  {chip.label}
                </Text>
                <Text style={[styles.weekChipCal, chip.active && styles.weekChipCalActive]}>
                  {chip.active ? chip.cal : '—'}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Overview */}
        <Text style={styles.sectionLabel}>Overview</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>⏱️</Text>
            <Text style={styles.statNum}>{formatMins(totalPracticeMs) || '0m'}</Text>
            <Text style={styles.statLabel}>Active minutes</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>📈</Text>
            <Text style={[styles.statNum, vsLabel !== null && vsLastWeek! >= 0 ? styles.numPositive : vsLabel !== null ? styles.numNegative : undefined]}>
              {vsLabel ?? '—'}
            </Text>
            <Text style={styles.statLabel}>vs. last week</Text>
          </View>
        </View>

        {/* By session */}
        {weekSessions.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>By session</Text>
            {[...weekSessions]
              .sort((a, b) => b.startTime - a.startTime)
              .map(s => {
                const durationMs = Math.max(0, s.endTime - s.startTime);
                const cal = sessionCal(s);
                return (
                  <View key={s.id} style={styles.sessionRow}>
                    <View style={styles.sessionIcon}>
                      <Text style={styles.sessionIconText}>{sessionIcon(s.moveId)}</Text>
                    </View>
                    <View style={styles.sessionInfo}>
                      <Text style={styles.sessionName} numberOfLines={1}>
                        {moveNames[s.moveId] ?? s.moveId}
                      </Text>
                      <Text style={styles.sessionMeta}>
                        {formatMins(durationMs)} · {relativeDay(s.startTime)}
                      </Text>
                    </View>
                    <View style={styles.sessionCal}>
                      <Text style={styles.sessionCalNum}>{cal}</Text>
                      <Text style={styles.sessionCalLabel}>cal</Text>
                    </View>
                  </View>
                );
              })}
          </>
        )}

        {/* Note card */}
        <View style={styles.noteCard}>
          <Text style={styles.noteText}>
            Estimates are based on session intensity and duration, not a wearable heart-rate sensor — think of this as a rough guide to how hard you trained, <Text style={styles.noteBold}>not a precise count.</Text>
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: 110 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  backChevron: { color: colors.text, fontSize: 22, lineHeight: 26, marginTop: -2 },
  topTitle: { color: colors.text, fontSize: 14, fontWeight: '800', letterSpacing: -0.1 },
  topSpacer: { width: 34 },
  heroHead: { paddingHorizontal: 20, paddingBottom: 6 },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.secondary[500],
    fontWeight: '800',
    marginBottom: 4,
  },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5, color: colors.text },

  ringCard: {
    marginHorizontal: 20,
    marginTop: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  ringWrap: { width: 190, height: 190, marginBottom: 6, position: 'relative' },
  ringCenter: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringNum: { fontSize: 38, fontWeight: '900', color: colors.text, letterSpacing: -0.8, lineHeight: 40 },
  ringUnit: { fontSize: 12, color: colors.textSecondary, fontWeight: '700', marginTop: 4 },
  ringSub: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    marginTop: 14,
    textAlign: 'center',
    maxWidth: 230,
    lineHeight: 16,
  },

  weekChipRow: { flexDirection: 'row', gap: 6, marginTop: 18 },
  weekChip: {
    width: 36,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.gray[700],
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  weekChipActive: {
    backgroundColor: 'rgba(255,107,74,0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,107,74,0.4)',
  },
  weekChipLabel: { fontSize: 10, fontWeight: '800', color: colors.textSecondary },
  weekChipLabelActive: { color: colors.secondary[500] },
  weekChipCal: { fontSize: 9, fontWeight: '700', color: colors.textSecondary, marginTop: 2 },
  weekChipCalActive: { color: colors.secondary[500] },

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

  statsGrid: { marginHorizontal: 20, flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
  },
  statIcon: { fontSize: 18, marginBottom: 10 },
  statNum: { fontSize: 22, fontWeight: '900', color: colors.text, letterSpacing: -0.3 },
  numPositive: { color: colors.primary[500] },
  numNegative: { color: colors.secondary[500] },
  statLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', marginTop: 2 },

  sessionRow: {
    marginHorizontal: 20,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },
  sessionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255,107,74,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sessionIconText: { fontSize: 18 },
  sessionInfo: { flex: 1 },
  sessionName: { fontSize: 13.5, fontWeight: '700', color: colors.text },
  sessionMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  sessionCal: { alignItems: 'flex-end' },
  sessionCalNum: { fontSize: 14, fontWeight: '800', color: colors.text },
  sessionCalLabel: { fontSize: 9.5, color: colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', marginTop: 1 },

  noteCard: {
    marginHorizontal: 20,
    marginTop: 18,
    backgroundColor: 'rgba(31,224,201,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(31,224,201,0.2)',
    borderRadius: 14,
    padding: 13,
    paddingHorizontal: 15,
  },
  noteText: { fontSize: 11.5, color: colors.textSecondary, fontWeight: '500', lineHeight: 17 },
  noteBold: { color: colors.text, fontWeight: '700' },
});
