import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { MainTabParamList } from '@/app/navigation/types';
import { theme } from '@/config/theme';
import { Card } from '@/shared/components/cards/Card';
import { Button } from '@/shared/components/buttons/Button';
import { movesRepository } from '@/core/data/repositories/MovesRepository';
import { Move } from '@/features/moves/types/move.types';

export const DashboardScreen = () => {
  const [moves, setMoves] = useState<Move[]>([]);
  const navigation = useNavigation<StackNavigationProp<MainTabParamList>>();

  useEffect(() => {
    loadMoves();
  }, []);

  const loadMoves = async () => {
    const allMoves = await movesRepository.getAll();
    setMoves(allMoves);
  };

  const handleNavigate = useCallback((moveId: string) => {
    navigation.navigate('Practice', { moveId });
  }, [navigation]);


  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Dance Frame</Text>
          <Text style={styles.subtitle}>Your AI Dance Coach</Text>
        </View>

        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Practice Time</Text>
            <Text style={styles.statValue}>12h 34m</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Streak</Text>
            <Text style={styles.statValue}>7 days 🔥</Text>
          </Card>
        </View>

        <Card style={styles.continueCard}>
          <Text style={styles.continueLabel}>CONTINUE LEARNING</Text>
          <Text style={styles.continueTitle}>Arm Wave</Text>
          <Button title="Practice Now" onPress={() => {}} style={styles.button} />
        </Card>

        <View style={styles.movesSection}>
          <Text style={styles.sectionTitle}>Moves Library</Text>
          {moves.map((move) => (
            <TouchableOpacity key={move.id} onPress={() => handleNavigate(move.id)}>
              <Card  style={styles.moveCard}>
                <Text style={styles.moveName}>{move.name}</Text>
                <Text style={styles.moveDifficulty}>{move.difficulty}</Text>
              </Card>
            </TouchableOpacity>
            
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.md,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.fontSize['4xl'],
    fontWeight: '700',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  statCard: {
    flex: 1,
  },
  statLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  statValue: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
  },
  continueCard: {
    backgroundColor: theme.colors.primary[600],
    marginBottom: theme.spacing.lg,
  },
  continueLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.primary[200],
    marginBottom: theme.spacing.xs,
  },
  continueTitle: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  button: {
    marginTop: theme.spacing.sm,
  },
  movesSection: {
    marginTop: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  moveCard: {
    marginBottom: theme.spacing.md,
  },
  moveName: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  moveDifficulty: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
});