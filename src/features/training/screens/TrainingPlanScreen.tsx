import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { colors } from '@/config/theme/colors';
import { spacing } from '@/config/theme/spacing';
import { typography } from '@/config/theme/typography';
import { useAppStore } from '@/core/state/store';
import { DaySession } from '../types/training.types';
import { formatTime } from '@/shared/utils/helper';

interface Props {
  navigation: any;
}

function getDayNumber(plan: { startDate: number } | null): number {
  if (!plan) return 1;
  return Math.min(Math.floor((Date.now() - plan.startDate) / 86400000) + 1, 30);
}

function sessionTotalSecs(session: DaySession): number {
  const active = session.drills.reduce((a, d) => a + d.durationSeconds, 0);
  const breaks = session.drills
    .slice(0, -1)
    .reduce((a, d) => a + d.breakSeconds, 0);
  return active + breaks;
}

interface DayCardProps {
  session: DaySession;
  isToday: boolean;
  isPast: boolean;
  onPress: () => void;
}

const DayCard: React.FC<DayCardProps> = ({ session, isToday, isPast, onPress }) => {
  const interactive = isToday || isPast;
  const totalSecs = sessionTotalSecs(session);

  let badgeStyle = styles.badgeFuture;
  let badgeText = String(session.dayNumber);
  if (session.isCompleted) {
    badgeStyle = styles.badgeComplete;
    badgeText = '✓';
  } else if (isToday) {
    badgeStyle = styles.badgeToday;
  }

  return (
    <TouchableOpacity
      style={[
        styles.dayCard,
        isToday && styles.dayCardToday,
        session.isCompleted && styles.dayCardComplete,
        !interactive && styles.dayCardLocked,
      ]}
      onPress={interactive ? onPress : undefined}
      activeOpacity={interactive ? 0.75 : 1}
    >
      <View style={[styles.dayBadge, badgeStyle]}>
        <Text style={styles.dayBadgeText}>{badgeText}</Text>
      </View>
      <View style={styles.dayInfo}>
        <Text style={[styles.dayTitle, !interactive && styles.dayTitleLocked]}>
          {session.isRestDay ? 'Rest Day' : `Day ${session.dayNumber}`}
        </Text>
        {!session.isRestDay && (
          <Text style={styles.dayMeta}>
            {session.drills.length} drill{session.drills.length !== 1 ? 's' : ''} · {formatTime(totalSecs)}
          </Text>
        )}
        {session.isRestDay && (
          <Text style={styles.dayMeta}>Light recovery · {formatTime(totalSecs)}</Text>
        )}
      </View>
      {interactive && !session.isCompleted && (
        <Text style={[styles.chevron, isToday && styles.chevronToday]}>›</Text>
      )}
      {!interactive && <Text style={styles.lockIcon}>🔒</Text>}
    </TouchableOpacity>
  );
};

export const TrainingPlanScreen: React.FC<Props> = ({ navigation }) => {
  const activePlan = useAppStore(state => state.activePlan);

  const todayDay = useMemo(() => getDayNumber(activePlan), [activePlan]);
  const completedCount = useMemo(
    () => activePlan?.sessions.filter(s => s.isCompleted).length ?? 0,
    [activePlan],
  );

  if (!activePlan) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>No active plan</Text>
          <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('GoalSetup')}>
            <Text style={styles.btnText}>Create Plan</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const weeks = [1, 2, 3, 4].map(w => ({
    week: w,
    sessions: activePlan.sessions.filter(s => {
      const start = (w - 1) * 7 + 1;
      const end = w * 7;
      return s.dayNumber >= start && s.dayNumber <= end;
    }),
  }));

  const progressPct = (completedCount / 30) * 100;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>My 30-Day Plan</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>{activePlan.danceStyle} · {activePlan.level}</Text>
          </View>
        </View>
        <View style={{ width: 60 }} />
      </View>

      {/* Progress bar */}
      <View style={styles.progressSection}>
        <Text style={styles.progressLabel}>{completedCount} / 30 days complete</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%` as any }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {weeks.map(({ week, sessions }) => (
          <View key={week} style={styles.weekSection}>
            <Text style={styles.weekLabel}>Week {week}</Text>
            {sessions.map(session => (
              <DayCard
                key={session.dayNumber}
                session={session}
                isToday={session.dayNumber === todayDay}
                isPast={session.dayNumber < todayDay || session.isCompleted}
                onPress={() =>
                  navigation.navigate('DaySessionDetail', { dayNumber: session.dayNumber })
                }
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.error, fontSize: typography.fontSize.lg, marginBottom: spacing.lg },
  btn: { backgroundColor: colors.primary[600], borderRadius: 12, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  btnText: { color: colors.text, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.bold },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backBtn: { color: colors.textSecondary, fontSize: typography.fontSize.base, width: 60 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: colors.text, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold },
  badge: {
    backgroundColor: 'rgba(168,85,247,0.18)',
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: 4,
  },
  badgeLabel: { color: colors.primary[400], fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold },
  progressSection: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  progressLabel: { color: colors.textSecondary, fontSize: typography.fontSize.sm, marginBottom: 6 },
  progressTrack: { height: 6, backgroundColor: colors.surface, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary[500], borderRadius: 3 },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing['3xl'] },
  weekSection: { marginBottom: spacing.lg },
  weekLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  dayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  dayCardToday: {
    borderColor: colors.primary[500],
    backgroundColor: 'rgba(168,85,247,0.08)',
  },
  dayCardComplete: {
    borderColor: colors.success + '44',
    backgroundColor: 'rgba(16,185,129,0.06)',
  },
  dayCardLocked: { opacity: 0.45 },
  dayBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeFuture: { backgroundColor: colors.gray[700] },
  badgeToday: { backgroundColor: colors.primary[600] },
  badgeComplete: { backgroundColor: colors.success },
  dayBadgeText: { color: colors.text, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  dayInfo: { flex: 1 },
  dayTitle: { color: colors.text, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold },
  dayTitleLocked: { color: colors.textSecondary },
  dayMeta: { color: colors.textSecondary, fontSize: typography.fontSize.xs, marginTop: 2 },
  chevron: { color: colors.textSecondary, fontSize: 22 },
  chevronToday: { color: colors.primary[400] },
  lockIcon: { fontSize: 14 },
});
