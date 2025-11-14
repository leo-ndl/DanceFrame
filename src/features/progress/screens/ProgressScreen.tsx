import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { theme } from '@/config/theme';
import { Card } from '@/shared/components/cards/Card';

export const ProgressScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Your Progress</Text>
        
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Weekly Activity</Text>
          <Text style={styles.comingSoon}>
            📊 Charts and analytics coming soon...
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Milestones</Text>
          <Text style={styles.comingSoon}>
            🏆 Start practicing to unlock achievements!
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Skills Breakdown</Text>
          <Text style={styles.comingSoon}>
            💪 Complete your first practice session
          </Text>
        </Card>
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
  title: {
    fontSize: theme.typography.fontSize['3xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
  card: {
    marginBottom: theme.spacing.md,
  },
  cardTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  comingSoon: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingVertical: theme.spacing.xl,
  },
});