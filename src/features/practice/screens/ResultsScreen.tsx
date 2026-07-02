import React, { useEffect } from 'react';
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
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { colors } from '@/config/theme/colors';
import { spacing } from '@/config/theme/spacing';
import { typography } from '@/config/theme/typography';
import { mmkvStorage } from '@/core/storage';
import { STORAGE_KEYS } from '@/config/constants/app';
import { PracticeSession } from '../types/session.types';
import { ScoreHero, scoreColor } from '../components/ScoreHero';

interface Props {
  route: { params: { sessionId: string } };
  navigation: any;
}

const AnimatedBar: React.FC<{ value: number; color: string; delay: number }> = ({
  value,
  color,
  delay,
}) => {
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withDelay(delay, withTiming(value, { duration: 700, easing: Easing.out(Easing.quad) }));
  }, []);
  const style = useAnimatedStyle(() => ({ width: `${width.value}%` as any }));
  return (
    <View style={barStyles.track}>
      <Animated.View style={[barStyles.fill, { backgroundColor: color }, style]} />
    </View>
  );
};

const barStyles = StyleSheet.create({
  track: { flex: 1, height: 10, backgroundColor: colors.surface, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
});

export const ResultsScreen: React.FC<Props> = ({ route, navigation }) => {
  const { sessionId } = route.params;
  const sessions = mmkvStorage.get<PracticeSession[]>(STORAGE_KEYS.SESSIONS) ?? [];
  const session = sessions.find(s => s.id === sessionId);

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Session not found</Text>
          <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('MainTabs')}>
            <Text style={styles.btnText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { score, metrics, repsCompleted, feedback } = session;

  const breakdown = [
    { label: 'Precision',  value: metrics.movementPrecision,  delay: 200 },
    { label: 'Timing',     value: metrics.timingAccuracy,     delay: 350 },
    { label: 'Isolation',  value: metrics.isolationQuality,   delay: 500 },
    { label: 'Consistency',value: metrics.consistency,        delay: 650 },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.navigate('MainTabs')} style={styles.backBtn}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Results</Text>
        <View style={styles.topSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Score hero */}
        <ScoreHero score={score} subtitle={`${repsCompleted} rep${repsCompleted !== 1 ? 's' : ''} completed`} />

        {/* Breakdown */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Breakdown</Text>
          {breakdown.map(item => (
            <View key={item.label} style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>{item.label}</Text>
              <AnimatedBar value={item.value} color={scoreColor(item.value)} delay={item.delay} />
              <Text style={[styles.breakdownValue, { color: scoreColor(item.value) }]}>
                {Math.round(item.value)}
              </Text>
            </View>
          ))}
        </View>

        {/* Feedback */}
        {feedback.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Feedback</Text>
            {feedback.map((f, i) => (
              <Text key={i} style={styles.feedbackLine}>{f}</Text>
            ))}
          </View>
        )}

        {/* Actions */}
        <TouchableOpacity
          style={styles.btn}
          onPress={() => navigation.navigate('Practice', { moveId: session.moveId })}
        >
          <Text style={styles.btnText}>🔄  Practice Again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => navigation.navigate('MainTabs')}
        >
          <Text style={styles.btnSecondaryText}>🏠  Go Home</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
  scroll: { padding: spacing.lg, paddingBottom: spacing['3xl'] },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.error, fontSize: typography.fontSize.lg, marginBottom: spacing.lg },
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
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  breakdownLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.xs,
    width: 80,
  },
  breakdownValue: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    width: 28,
    textAlign: 'right',
  },
  feedbackLine: {
    color: colors.text,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.sm,
    lineHeight: 22,
  },
  btn: {
    backgroundColor: colors.primary[600],
    borderRadius: 14,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  btnText: {
    color: colors.text,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  btnSecondary: {
    borderRadius: 14,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnSecondaryText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.base,
  },
});
