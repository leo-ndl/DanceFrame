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
import { DaySession, TrainingDrill } from '../types/training.types';
import { formatTime } from '@/shared/utils/helper';

interface Props {
  route: { params: { dayNumber: number } };
  navigation: any;
}

export const DaySessionDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { dayNumber } = route.params;
  const activePlan = useAppStore(state => state.activePlan);

  const session: DaySession | undefined = useMemo(
    () => activePlan?.sessions.find(s => s.dayNumber === dayNumber),
    [activePlan, dayNumber],
  );

  const { activeSecs, breakSecs } = useMemo(() => {
    if (!session) return { activeSecs: 0, breakSecs: 0 };
    const active = session.drills.reduce((a, d) => a + d.durationSeconds, 0);
    const brks = session.drills.slice(0, -1).reduce((a, d) => a + d.breakSeconds, 0);
    return { activeSecs: active, breakSecs: brks };
  }, [session]);

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Session not found</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backChevron}>‹</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>
          {session.isRestDay ? 'Rest Day' : `Day ${dayNumber}`}
        </Text>
        <View style={styles.topSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Session summary card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{formatTime(activeSecs)}</Text>
              <Text style={styles.summaryLabel}>Active</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{formatTime(breakSecs)}</Text>
              <Text style={styles.summaryLabel}>Rest</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{formatTime(activeSecs + breakSecs)}</Text>
              <Text style={styles.summaryLabel}>Total</Text>
            </View>
          </View>
        </View>

        {/* Drills list */}
        <Text style={styles.sectionTitle}>Today's Drills</Text>

        {session.drills.map((drill: TrainingDrill, index: number) => (
          <View key={drill.id}>
            <View style={styles.drillRow}>
              <View style={styles.drillNumber}>
                <Text style={styles.drillNumberText}>{index + 1}</Text>
              </View>
              <View style={styles.drillInfo}>
                <Text style={styles.drillName}>{drill.name}</Text>
                <Text style={styles.drillDesc} numberOfLines={2}>{drill.description}</Text>
              </View>
              <View style={styles.drillDuration}>
                <Text style={styles.drillDurationText}>{drill.durationSeconds}s</Text>
              </View>
            </View>

            {index < session.drills.length - 1 && (
              <View style={styles.breakRow}>
                <View style={styles.breakLine} />
                <Text style={styles.breakLabel}>{drill.breakSeconds}s rest</Text>
                <View style={styles.breakLine} />
              </View>
            )}
          </View>
        ))}

        {/* Completed badge */}
        {session.isCompleted && (
          <View style={styles.completedBadge}>
            <Text style={styles.completedText}>✓ Session Completed</Text>
          </View>
        )}
      </ScrollView>

      {/* Sticky start button */}
      {!session.isCompleted ? (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => navigation.navigate('PlanPractice', { dayNumber })}
            activeOpacity={0.85}
          >
            <Text style={styles.startBtnText}>▶  Start Session</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.replayBtn}
            onPress={() => navigation.navigate('PlanPractice', { dayNumber })}
            activeOpacity={0.85}
          >
            <Text style={styles.replayBtnText}>🔄  Practice Again</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.error, fontSize: typography.fontSize.lg, marginBottom: spacing.md },
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
  scroll: { padding: spacing.lg, paddingBottom: 120 },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: {
    color: colors.text,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  summaryLabel: { color: colors.textSecondary, fontSize: typography.fontSize.xs, marginTop: 2 },
  summaryDivider: { width: 1, height: 36, backgroundColor: colors.border },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.md,
  },
  drillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  drillNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary[800],
    alignItems: 'center',
    justifyContent: 'center',
  },
  drillNumberText: {
    color: colors.primary[300],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  drillInfo: { flex: 1 },
  drillName: {
    color: colors.text,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  drillDesc: { color: colors.textSecondary, fontSize: typography.fontSize.xs, marginTop: 2 },
  drillDuration: {
    backgroundColor: colors.gray[700],
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  drillDurationText: {
    color: colors.text,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  breakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.sm,
    gap: spacing.sm,
  },
  breakLine: { flex: 1, height: 1, backgroundColor: colors.border },
  breakLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.xs,
    fontStyle: 'italic',
  },
  completedBadge: {
    marginTop: spacing.lg,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.success + '44',
  },
  completedText: {
    color: colors.success,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  startBtn: {
    backgroundColor: colors.primary[600],
    borderRadius: 16,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  startBtnText: {
    color: colors.text,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  replayBtn: {
    borderRadius: 16,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  replayBtnText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
});
