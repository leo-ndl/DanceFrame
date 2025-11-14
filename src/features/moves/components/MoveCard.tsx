import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Card } from '@/shared/components/cards/Card';
import { theme } from '@/config/theme';
import { Move } from '../types/move.types';

interface MoveCardProps {
  move: Move;
  onPress: () => void;
  score?: number;
}

export const MoveCard: React.FC<MoveCardProps> = ({ move, onPress, score }) => {
  const getDifficultyColor = () => {
    switch (move.difficulty) {
      case 'Beginner':
        return theme.colors.success;
      case 'Intermediate':
        return theme.colors.warning;
      case 'Advanced':
        return theme.colors.error;
      default:
        return theme.colors.gray[500];
    }
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.card}>
        <View style={styles.content}>
          <View style={styles.leftContent}>
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>💃</Text>
            </View>
            <View>
              <Text style={styles.name}>{move.name}</Text>
              <View style={styles.badgeContainer}>
                <View style={[styles.badge, { backgroundColor: getDifficultyColor() }]}>
                  <Text style={styles.badgeText}>{move.difficulty}</Text>
                </View>
              </View>
            </View>
          </View>
          
          {score !== undefined && (
            <View style={styles.scoreContainer}>
              <Text style={styles.score}>{score}%</Text>
            </View>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: theme.spacing.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  icon: {
    fontSize: 24,
  },
  name: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  badgeContainer: {
    flexDirection: 'row',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    color: '#fff',
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  score: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
  },
});