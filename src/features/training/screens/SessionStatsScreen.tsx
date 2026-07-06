import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { colors } from '@/config/theme/colors';
import { spacing } from '@/config/theme/spacing';
import { typography } from '@/config/theme/typography';
import { trainingPlanRepository } from '@/core/data/repositories/TrainingPlanRepository';
import { mmkvStorage } from '@/core/storage';
import { STORAGE_KEYS } from '@/config/constants/app';
import { formatTime } from '@/shared/utils/helper';
import { useAppStore } from '@/core/state/store';

interface Props {
  route: { params: { sessionStatsId: string } };
  navigation: any;
}

function calcStreak(): number {
  const practiceSessions: Array<{ endTime?: number; completedAt?: number }> =
    mmkvStorage.get<any[]>(STORAGE_KEYS.SESSIONS) ?? [];
  const planSessions: Array<{ completedAt?: number }> =
    trainingPlanRepository.getCompletedSessions();

  const allTimestamps = [
    ...practiceSessions.map(s => s.endTime ?? 0),
    ...planSessions.map(s => s.completedAt ?? 0),
  ].filter(Boolean);

  const days = new Set(
    allTimestamps.map(ts => {
      const d = new Date(ts);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }),
  );

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 90; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (days.has(key)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

const StatCard: React.FC<{ value: string; label: string; delay: number }> = ({
  value,
  label,
  delay,
}) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 400 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[statStyles.card, style]}>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </Animated.View>
  );
};

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  value: { color: colors.text, fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold },
  label: { color: colors.textSecondary, fontSize: typography.fontSize.xs, marginTop: 4, textAlign: 'center' },
});

export const SessionStatsScreen: React.FC<Props> = ({ route, navigation }) => {
  const { sessionStatsId } = route.params;
  const activePlan = useAppStore(s => s.activePlan);

  const stats = useMemo(
    () => trainingPlanRepository.getSessionById(sessionStatsId),
    [sessionStatsId],
  );

  const streak = useMemo(() => calcStreak(), []);

  const heroScale = useSharedValue(0);
  const heroOpacity = useSharedValue(0);

  useEffect(() => {
    heroOpacity.value = withTiming(1, { duration: 400 });
    heroScale.value = withSpring(1, { damping: 12, stiffness: 100 });
  }, []);

  const heroStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heroScale.value }],
    opacity: heroOpacity.value,
  }));

  const planStyle = activePlan?.danceStyle ?? 'Dance';

  if (!stats) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Session data not found</Text>
          <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('MainTabs')}>
            <Text style={styles.btnText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const allDone = stats.drillsCompleted === stats.drillsTotal;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <Animated.View style={[styles.hero, heroStyle]}>
          <Text style={styles.heroEmoji}>{allDone ? '🎉' : '💪'}</Text>
          <Text style={styles.heroTitle}>
            {allDone ? 'Session Complete!' : 'Good Effort!'}
          </Text>
          <Text style={styles.heroSub}>Day {stats.dayNumber} · {planStyle}</Text>
        </Animated.View>

        {/* Completion rate */}
        <View style={styles.rateCard}>
          <Text style={[styles.rateValue, { color: allDone ? colors.success : colors.primary[400] }]}>
            {stats.completionRate}%
          </Text>
          <Text style={styles.rateLabel}>
            {stats.drillsCompleted} / {stats.drillsTotal} drills completed
          </Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCard value={formatTime(stats.totalActiveSecs)} label="Active Time" delay={150} />
          <StatCard value={formatTime(stats.totalBreakSecs)} label="Rest Time" delay={250} />
          <StatCard value={`${streak}d`} label="Streak" delay={350} />
        </View>

        {/* Drill breakdown */}
        {stats.completedDrillNames.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Drills Completed</Text>
            {Array.from({ length: stats.drillsTotal }, (_, i) => {
              const name = stats.completedDrillNames[i];
              const done = i < stats.drillsCompleted;
              return (
                <View key={i} style={styles.drillRow}>
                  <Text style={[styles.drillCheck, done ? styles.drillCheckDone : styles.drillCheckMiss]}>
                    {done ? '✓' : '✗'}
                  </Text>
                  <Text style={[styles.drillName, !done && styles.drillNameMiss]}>
                    {name ?? `Drill ${i + 1}`}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Actions */}
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('TrainingPlan')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>View My Plan</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.navigate('MainTabs')}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryBtnText}>Go Home</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.error, fontSize: typography.fontSize.lg, marginBottom: spacing.lg },
  scroll: { padding: spacing.lg, paddingBottom: spacing['3xl'] },
  hero: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
  },
  heroEmoji: { fontSize: 64, marginBottom: spacing.sm },
  heroTitle: {
    color: colors.text,
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  heroSub: { color: colors.textSecondary, fontSize: typography.fontSize.base },
  rateCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rateValue: {
    fontSize: 72,
    fontWeight: typography.fontWeight.bold,
    lineHeight: 80,
  },
  rateLabel: { color: colors.textSecondary, fontSize: typography.fontSize.sm, marginTop: spacing.xs },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    color: colors.text,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.md,
  },
  drillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  drillCheck: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.bold, width: 20 },
  drillCheckDone: { color: colors.success },
  drillCheckMiss: { color: colors.error },
  drillName: { color: colors.text, fontSize: typography.fontSize.sm, flex: 1 },
  drillNameMiss: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  btn: { backgroundColor: colors.primary[600], borderRadius: 12, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  btnText: { color: colors.text, fontWeight: typography.fontWeight.bold, fontSize: typography.fontSize.base },
  primaryBtn: {
    backgroundColor: colors.primary[600],
    borderRadius: 16,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  primaryBtnText: { color: colors.text, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold },
  secondaryBtn: {
    borderRadius: 16,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: { color: colors.textSecondary, fontSize: typography.fontSize.lg },
});
