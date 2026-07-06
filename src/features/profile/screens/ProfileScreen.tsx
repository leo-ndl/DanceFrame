import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/app/navigation/types';
import { colors } from '@/config/theme/colors';
import { theme } from '@/config/theme';
import { useAppStore } from '@/core/state/store';
import { mmkvStorage } from '@/core/storage';
import { STORAGE_KEYS } from '@/config/constants/app';
import { PracticeSession } from '@/features/practice/types/session.types';
import { formatTime } from '@/shared/utils/helper';

export const ProfileScreen = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const userName = useAppStore(state => state.userName);
  const activePlan = useAppStore(state => state.activePlan);
  const [totalPracticeMs, setTotalPracticeMs] = useState(0);
  const [streak, setStreak] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);

  const loadStats = useCallback(() => {
    const sessions = mmkvStorage.get<PracticeSession[]>(STORAGE_KEYS.SESSIONS) ?? [];
    const totalMs = sessions.reduce((acc, s) => acc + (s.endTime - s.startTime), 0);
    setTotalPracticeMs(totalMs);
    setSessionCount(sessions.length);

    const daySet = new Set(sessions.map(s => new Date(s.startTime).toDateString()));
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

  useEffect(() => { loadStats(); }, [loadStats]);

  const displayName = userName ?? 'Dancer';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.screenTitle}>Profile</Text>

        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.tagline}>Dance Frame Member</Text>
        </View>

        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.statBox} onPress={() => navigation.navigate('Streak')} activeOpacity={0.7}>
            <Text style={styles.statNum}>{streak > 0 ? streak : 0}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>
              {totalPracticeMs > 0 ? formatTime(Math.round(totalPracticeMs / 1000)) : '0m'}
            </Text>
            <Text style={styles.statLabel}>Practice Time</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{sessionCount}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
        </View>

        {activePlan ? (
          <TouchableOpacity
            style={styles.planBtn}
            onPress={() => navigation.navigate('TrainingPlan')}
            activeOpacity={0.8}
          >
            <Text style={styles.planBtnText}>View Training Plan</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.planBtn}
            onPress={() => navigation.navigate('GoalSetup')}
            activeOpacity={0.8}
          >
            <Text style={styles.planBtnText}>Start 30-Day Plan</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: theme.spacing.md, paddingBottom: 40 },
  screenTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    marginBottom: theme.spacing.xl,
    marginTop: theme.spacing.sm,
  },
  avatarSection: { alignItems: 'center', marginBottom: theme.spacing.xl },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  avatarInitial: { fontSize: 36, fontWeight: '800', color: '#062420' },
  name: { fontSize: 22, fontWeight: '900', color: colors.text, marginBottom: 4 },
  tagline: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: colors.border },
  statNum: { fontSize: 20, fontWeight: '900', color: colors.text, marginBottom: 2 },
  statLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  planBtn: {
    backgroundColor: colors.primary[500],
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  planBtnText: { color: '#062420', fontSize: 15, fontWeight: '800' },
});
