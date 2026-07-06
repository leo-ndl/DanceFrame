import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/config/theme/colors';
import { spacing } from '@/config/theme/spacing';
import { typography } from '@/config/theme/typography';
import { useAppStore } from '@/core/state/store';
import { DaySession, DanceStyle } from '../types/training.types';
import { ProgressBar } from '@/features/progress/components/progress/ProgressBar';

// ─── helpers ────────────────────────────────────────────────────────────────

function getTodayDayNumber(startDate: number): number {
  return Math.min(Math.floor((Date.now() - startDate) / 86400000) + 1, 30);
}

function getDayName(startDate: number, dayNumber: number): string {
  return new Date(startDate + (dayNumber - 1) * 86400000).toLocaleDateString('en-US', {
    weekday: 'long',
  });
}

function fmtDrillDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function sessionTotalMins(session: DaySession): number {
  const active = session.drills.reduce((a, d) => a + d.durationSeconds, 0);
  const breaks = session.drills.slice(0, -1).reduce((a, d) => a + d.breakSeconds, 0);
  return Math.ceil((active + breaks) / 60);
}

function deriveSessionTitle(session: DaySession): string {
  if (session.isRestDay) return 'Rest Day';
  if (session.drills.length === 0) return `Day ${session.dayNumber}`;
  const first = session.drills[0].name.replace(/ (Practice|Sequence|Combo)s?$/i, '');
  return session.drills.length > 2 ? `${first} & More` : first;
}

const GOAL_TITLES: Record<DanceStyle, string> = {
  Popping: 'Hit Control & Isolations',
  HipHop: 'Groove & Freestyle',
  Locking: 'Lock & Precision',
  Animation: 'Smooth Animation',
  House: 'House Footwork',
  Krump: 'Krump Power',
};

// ─── DayMarker ──────────────────────────────────────────────────────────────

type MarkerState = 'done' | 'today' | 'future';

const DayMarker: React.FC<{ state: MarkerState }> = ({ state }) => {
  if (state === 'done') {
    return (
      <View style={[styles.marker, styles.markerDone]}>
        <Svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke={colors.gray[900]} strokeWidth={3}>
          <Path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
    );
  }
  if (state === 'today') {
    return (
      <View style={[styles.marker, styles.markerToday]}>
        <View style={styles.markerTodayDot} />
      </View>
    );
  }
  return <View style={[styles.marker, styles.markerFuture]} />;
};

// ─── DayNode ─────────────────────────────────────────────────────────────────

interface DayNodeProps {
  session: DaySession;
  isToday: boolean;
  startDate: number;
  onPress: () => void;
}

const DayNode: React.FC<DayNodeProps> = ({ session, isToday, startDate, onPress }) => {
  const markerState: MarkerState = session.isCompleted ? 'done' : isToday ? 'today' : 'future';
  const dayName = getDayName(startDate, session.dayNumber);
  const title = deriveSessionTitle(session);
  const totalMins = sessionTotalMins(session);
  const meta = `${session.drills.length} move${session.drills.length !== 1 ? 's' : ''} · ${totalMins} min`;

  return (
    <View style={styles.dayNode}>
      <View style={styles.markerCol}>
        <DayMarker state={markerState} />
      </View>

      {session.isRestDay ? (
        <View style={[styles.dayCard, styles.dayCardRest]}>
          <Text style={styles.dayLabel}>{dayName}</Text>
          <Text style={styles.restText}>Rest day</Text>
        </View>
      ) : isToday ? (
        <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={styles.dayCardWrapper}>
          <LinearGradient
            colors={['#0f2422', colors.surface]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.dayCard, styles.dayCardToday]}
          >
            <Text style={styles.dayLabel}>{dayName} · Today</Text>
            <Text style={styles.dayTitle}>{title}</Text>
            <Text style={styles.dayMeta}>{meta}</Text>
            <View style={styles.movesList}>
              {session.drills.map((drill, i) => (
                <View key={drill.id} style={styles.moveRow}>
                  <View style={styles.moveNum}>
                    <Text style={styles.moveNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.moveName}>{drill.name}</Text>
                  <Text style={styles.moveDuration}>{fmtDrillDuration(drill.durationSeconds)}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.75}
          style={[styles.dayCard, session.isCompleted && styles.dayCardDone]}
        >
          <Text style={styles.dayLabel}>{dayName}</Text>
          <Text style={styles.dayTitle}>{title}</Text>
          <Text style={styles.dayMeta}>{meta}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── TrainingPlanScreen ───────────────────────────────────────────────────────

interface Props {
  navigation: any;
}

export const TrainingPlanScreen: React.FC<Props> = ({ navigation }) => {
  const activePlan = useAppStore(state => state.activePlan);

  const todayDay = useMemo(
    () => (activePlan ? getTodayDayNumber(activePlan.startDate) : 1),
    [activePlan],
  );

  const currentWeek = Math.min(Math.ceil(todayDay / 7), 4);
  const weekStart = (currentWeek - 1) * 7 + 1;
  const weekEnd = currentWeek === 4 ? 30 : currentWeek * 7;

  const weekSessions = useMemo(
    () =>
      activePlan?.sessions.filter(
        s => s.dayNumber >= weekStart && s.dayNumber <= weekEnd,
      ) ?? [],
    [activePlan, weekStart, weekEnd],
  );

  const weekActive = useMemo(
    () => weekSessions.filter(s => !s.isRestDay).length,
    [weekSessions],
  );

  const weekDone = useMemo(
    () => weekSessions.filter(s => s.isCompleted).length,
    [weekSessions],
  );

  const weeklyFreq = useMemo(
    () =>
      activePlan?.sessions.filter(
        s => s.dayNumber >= 1 && s.dayNumber <= 7 && !s.isRestDay,
      ).length ?? 5,
    [activePlan],
  );

  const weekGroups = useMemo(() => {
    if (!activePlan) return [];
    return ([1, 2, 3, 4] as const).map(weekNum => {
      const start = (weekNum - 1) * 7 + 1;
      const end = weekNum === 4 ? 30 : weekNum * 7;
      return {
        weekNum,
        sessions: activePlan.sessions.filter(s => s.dayNumber >= start && s.dayNumber <= end),
      };
    });
  }, [activePlan]);

  if (!activePlan) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No active plan</Text>
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => navigation.navigate('GoalSetup')}
            activeOpacity={0.85}
          >
            <Text style={styles.createBtnText}>Create Plan</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const progressPct = weekActive > 0 ? (weekDone / weekActive) * 100 : 0;
  const goalTitle = GOAL_TITLES[activePlan.danceStyle] ?? `${activePlan.danceStyle} Fundamentals`;
  const goalSub = `${activePlan.danceStyle} · ${activePlan.level} · ${weeklyFreq}x / week`;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>30-Day Program</Text>
          <Text style={styles.title}>Your Plan</Text>
        </View>

        {/* Week progress card */}
        <View style={styles.weekCard}>
          <View style={styles.weekCardTop}>
            <Text style={styles.weekCardLabel}>
              Week {currentWeek} · {weekDone} of {weekActive} sessions done
            </Text>
            <Text style={styles.weekCardFrac}>{Math.round(progressPct)}%</Text>
          </View>
          <ProgressBar
            progress={progressPct}
            height={8}
            color={colors.primary[500]}
            backgroundColor={colors.surface2}
          />
        </View>

        {/* Goal section */}
        <Text style={styles.sectionLabel}>Goal</Text>
        <View style={styles.goalCard}>
          <View style={styles.goalIcon}>
            <Text style={styles.goalIconEmoji}>🎯</Text>
          </View>
          <View style={styles.goalTextCol}>
            <Text style={styles.goalTitle}>{goalTitle}</Text>
            <Text style={styles.goalSub}>{goalSub}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('GoalSetup')}>
            <Text style={styles.goalEditBtn}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Full 30-day timeline grouped by week */}
        {weekGroups.map(({ weekNum, sessions }) => (
          <View key={weekNum}>
            <Text style={styles.sectionLabel}>Week {weekNum}</Text>
            <View style={styles.timeline}>
              <View style={styles.timelineLine} />
              {sessions.map(session => (
                <DayNode
                  key={session.dayNumber}
                  session={session}
                  isToday={session.dayNumber === todayDay}
                  startDate={activePlan.startDate}
                  onPress={() =>
                    navigation.navigate('DaySessionDetail', { dayNumber: session.dayNumber })
                  }
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── styles ──────────────────────────────────────────────────────────────────

const MARKER_COL_W = 42;
const MARKER_SIZE = 28;
const LINE_LEFT = MARKER_COL_W / 2 - 1;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingBottom: 120,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.lg,
  },
  createBtn: {
    backgroundColor: colors.primary[600],
    borderRadius: 14,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  createBtnText: {
    color: colors.text,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },

  // header
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.primary[500],
    fontWeight: '800',
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: colors.text,
  },

  // week progress card
  weekCard: {
    marginHorizontal: spacing.lg,
    marginTop: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 18,
  },
  weekCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  weekCardLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  weekCardFrac: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },

  // section labels
  sectionLabel: {
    marginHorizontal: spacing.lg,
    marginTop: 28,
    marginBottom: 12,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    fontWeight: '700',
  },
  // goal card
  goalCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  goalIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.turquoiseTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalIconEmoji: {
    fontSize: 18,
  },
  goalTextCol: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.text,
  },
  goalSub: {
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  goalEditBtn: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary[500],
  },

  // timeline
  timeline: {
    marginHorizontal: spacing.lg,
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    left: LINE_LEFT,
    top: MARKER_SIZE / 2,
    bottom: MARKER_SIZE / 2,
    width: 2,
    backgroundColor: colors.border,
  },

  // day node
  dayNode: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  markerCol: {
    width: MARKER_COL_W,
    alignItems: 'center',
    paddingTop: 2,
    zIndex: 2,
  },
  dayCardWrapper: {
    flex: 1,
  },
  dayCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
  },
  dayCardRest: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  dayCardToday: {
    borderColor: 'rgba(31, 224, 201, 0.4)',
    borderRadius: 16,
    padding: 14,
  },
  dayCardDone: {
    borderColor: colors.primary[500] + '44',
  },

  dayLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  dayTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  dayMeta: {
    fontSize: 11.5,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  restText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },

  // marker
  marker: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  markerDone: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  markerToday: {
    backgroundColor: colors.background,
    borderColor: colors.primary[500],
  },
  markerTodayDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary[500],
  },
  markerFuture: {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
  },

  // moves list (today expanded)
  movesList: {
    marginTop: 12,
    gap: 8,
  },
  moveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  moveNum: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  moveNumText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  moveName: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.text,
  },
  moveDuration: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
});
