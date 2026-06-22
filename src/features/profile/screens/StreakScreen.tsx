import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/app/navigation/types';
import { colors } from '@/config/theme/colors';
import { mmkvStorage } from '@/core/storage';
import { STORAGE_KEYS } from '@/config/constants/app';
import { PracticeSession } from '@/features/practice/types/session.types';
import { useAppStore } from '@/core/state/store';

// ─── constants ───────────────────────────────────────────────────────────────

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const MILESTONES = [
  { days: 7,   emoji: '🔥', label: '7-day streak' },
  { days: 30,  emoji: '⚡', label: '30-day streak' },
  { days: 100, emoji: '👑', label: '100-day streak' },
];

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtShortDate(date: Date): string {
  return `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}`;
}

// ─── StreakScreen ─────────────────────────────────────────────────────────────

export const StreakScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const activePlan = useAppStore(s => s.activePlan);
  const streakFreezes = useAppStore(s => s.streakFreezes);

  const [streak, setStreak] = useState(0);
  const [weekDays, setWeekDays] = useState<Array<{ letter: string; done: boolean; isToday: boolean }>>([]);

  const loadStats = useCallback(() => {
    const sessions = mmkvStorage.get<PracticeSession[]>(STORAGE_KEYS.SESSIONS) ?? [];
    const daySet = new Set(sessions.map(s => new Date(s.startTime).toDateString()));
    const today = new Date();

    // streak count (consecutive days back from today)
    let count = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (daySet.has(d.toDateString())) count++;
      else if (i > 0) break;
    }
    setStreak(count);

    // current week Sun-Sat
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay());
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      return {
        letter: DAY_LETTERS[i],
        done: daySet.has(d.toDateString()),
        isToday: d.toDateString() === today.toDateString(),
      };
    });
    setWeekDays(days);
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const todayDayNumber = useMemo(() => {
    if (!activePlan) return null;
    return Math.min(Math.floor((Date.now() - activePlan.startDate) / 86400000) + 1, 30);
  }, [activePlan]);

  const handlePracticeToday = useCallback(() => {
    if (activePlan && todayDayNumber !== null) {
      navigation.navigate('DaySessionDetail', { dayNumber: todayDayNumber });
    } else {
      navigation.navigate('GoalSetup');
    }
  }, [activePlan, todayDayNumber, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>Your Streak</Text>
          <View style={styles.topSpacer} />
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.flameBig}>
            <Text style={styles.flameEmoji}>🔥</Text>
          </View>
          <Text style={styles.streakCount}>{streak}</Text>
          <Text style={styles.streakDays}>DAY STREAK</Text>
        </View>

        {/* Week strip */}
        <View style={styles.weekStrip}>
          {weekDays.map((day, i) => (
            <View key={i} style={styles.dayCol}>
              <Text style={styles.dayLetter}>{day.letter}</Text>
              <View
                style={[
                  styles.dayDot,
                  day.done && styles.dayDotDone,
                  day.isToday && !day.done && styles.dayDotToday,
                ]}
              >
                {day.done && (
                  <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="white" strokeWidth={3}>
                    <Path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Streak Freeze card */}
        <View style={styles.freezeCard}>
          <View style={styles.freezeIcon}>
            <Text style={styles.freezeIconEmoji}>❄️</Text>
          </View>
          <View style={styles.freezeText}>
            <Text style={styles.freezeTitle}>Streak Freeze</Text>
            <Text style={styles.freezeSub}>Protects your streak if you miss a day</Text>
          </View>
          <View style={styles.freezeCountBadge}>
            <Text style={styles.freezeCountText}>{streakFreezes}</Text>
          </View>
        </View>

        {/* Milestones */}
        <Text style={styles.milestoneLabel}>Milestones</Text>
        <View style={styles.milestoneCard}>
          {MILESTONES.map((m, i) => {
            const isDone = streak >= m.days;
            const completedDate = isDone
              ? fmtShortDate(new Date(Date.now() - (streak - m.days) * 86400000))
              : null;
            const daysToGo = m.days - streak;

            return (
              <React.Fragment key={m.days}>
                {i > 0 && <View style={styles.milestoneDivider} />}
                <View style={styles.milestoneRow}>
                  <View style={[styles.milestoneBadge, isDone ? styles.milestoneBadgeDone : styles.milestoneBadgeLocked]}>
                    <Text style={[styles.milestoneBadgeEmoji, !isDone && styles.milestoneLocked]}>
                      {m.emoji}
                    </Text>
                  </View>
                  <View style={styles.milestoneInfo}>
                    <Text style={[styles.milestoneName, !isDone && styles.milestoneNameLocked]}>
                      {m.label}
                    </Text>
                    <Text style={styles.milestoneSub}>
                      {isDone ? `Completed ${completedDate}` : `${daysToGo} day${daysToGo !== 1 ? 's' : ''} to go`}
                    </Text>
                  </View>
                </View>
              </React.Fragment>
            );
          })}
        </View>

      </ScrollView>

      {/* Fixed CTA */}
      <View style={styles.ctaWrapper}>
        <TouchableOpacity style={styles.ctaBtn} onPress={handlePracticeToday} activeOpacity={0.85}>
          <Text style={styles.ctaBtnText}>Practice Today</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: 120 },

  // top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 4,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: { color: colors.text, fontSize: 22, lineHeight: 26, marginTop: -2 },
  topTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.1,
  },
  topSpacer: { width: 34 },

  // hero
  hero: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28 },
  flameBig: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,107,74,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: colors.secondary[500],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 8,
  },
  flameEmoji: { fontSize: 64, lineHeight: 76 },
  streakCount: {
    fontSize: 56,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -1.5,
    lineHeight: 60,
  },
  streakDays: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '700',
    marginTop: 6,
    letterSpacing: 1,
  },

  // week strip
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    marginTop: 30,
    marginBottom: 8,
  },
  dayCol: { alignItems: 'center', gap: 8 },
  dayLetter: { fontSize: 11, color: colors.textSecondary, fontWeight: '700' },
  dayDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface2,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDotDone: {
    backgroundColor: colors.secondary[500],
    borderColor: colors.secondary[500],
  },
  dayDotToday: {
    borderColor: colors.primary[500],
    borderWidth: 2,
  },

  // freeze card
  freezeCard: {
    marginHorizontal: 20,
    marginTop: 30,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  freezeIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.turquoiseTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freezeIconEmoji: { fontSize: 20 },
  freezeText: { flex: 1 },
  freezeTitle: { fontSize: 13.5, fontWeight: '800', color: colors.text },
  freezeSub: { fontSize: 11.5, color: colors.textSecondary, fontWeight: '500', marginTop: 2 },
  freezeCountBadge: {
    backgroundColor: colors.surface2,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  freezeCountText: { fontSize: 15, fontWeight: '900', color: colors.text },

  // milestones
  milestoneLabel: {
    marginHorizontal: 20,
    marginTop: 30,
    marginBottom: 14,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    fontWeight: '700',
  },
  milestoneCard: {
    marginHorizontal: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 18,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
  },
  milestoneDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: -18,
  },
  milestoneBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  milestoneBadgeDone: { backgroundColor: colors.turquoiseTint },
  milestoneBadgeLocked: { backgroundColor: colors.surface2, opacity: 0.5 },
  milestoneBadgeEmoji: { fontSize: 16 },
  milestoneLocked: { opacity: 0.5 },
  milestoneInfo: { flex: 1 },
  milestoneName: { fontSize: 13.5, fontWeight: '700', color: colors.text },
  milestoneNameLocked: { color: colors.textSecondary },
  milestoneSub: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },

  // CTA
  ctaWrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 30,
  },
  ctaBtn: {
    backgroundColor: colors.primary[500],
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: colors.primary[500],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 6,
  },
  ctaBtnText: {
    color: '#06201D',
    fontWeight: '800',
    fontSize: 15,
  },
});
