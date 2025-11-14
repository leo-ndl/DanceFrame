import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { theme } from '@/config/theme';
import { Card } from '@/shared/components/cards/Card';
import { Button } from '@/shared/components/buttons/Button';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { movesRepository } from '@/core/data/repositories/MovesRepository';
import { Move } from '../types/move.types';

interface MoveDetailScreenProps {
  route: {
    params: {
      moveId: string;
    };
  };
  navigation: any;
}

export const MoveDetailScreen: React.FC<MoveDetailScreenProps> = ({
  route,
  navigation,
}) => {
  const { moveId } = route.params;
  const [move, setMove] = useState<Move | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMove();
  }, [moveId]);

  const loadMove = async () => {
    const data = await movesRepository.getById(moveId);
    setMove(data);
    setLoading(false);
  };

  if (loading) {
    return <LoadingSpinner message="Loading move..." />;
  }

  if (!move) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Move not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{move.name}</Text>
        <View style={styles.metaContainer}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{move.difficulty}</Text>
          </View>
          <Text style={styles.duration}>{move.duration}s • {move.bpm} BPM</Text>
        </View>

        <Card style={styles.descriptionCard}>
          <Text style={styles.sectionTitle}>About This Move</Text>
          <Text style={styles.description}>{move.description}</Text>
        </Card>

        <Card style={styles.keyPointsCard}>
          <Text style={styles.sectionTitle}>Key Technique Points</Text>
          {move.keyPoints.map((point, index) => (
            <View key={index} style={styles.keyPoint}>
              <View style={styles.checkmark}>
                <Text style={styles.checkmarkText}>✓</Text>
              </View>
              <Text style={styles.keyPointText}>{point}</Text>
            </View>
          ))}
        </Card>

        <Button
          title="Start Practice"
          onPress={() => {
            // Navigate to practice screen
            // navigation.navigate('Practice', { moveId });
            console.log('Practice mode coming soon!');
          }}
          size="large"
          style={styles.practiceButton}
        />
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
  backButton: {
    marginBottom: theme.spacing.lg,
  },
  backText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.primary[400],
  },
  title: {
    fontSize: theme.typography.fontSize['3xl'],
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  badge: {
    backgroundColor: theme.colors.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: theme.typography.fontSize.sm,
  },
  duration: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  descriptionCard: {
    marginBottom: theme.spacing.md,
  },
  keyPointsCard: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  description: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
    lineHeight: 24,
  },
  keyPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  checkmarkText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  keyPointText: {
    flex: 1,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text,
    lineHeight: 20,
  },
  practiceButton: {
    marginTop: theme.spacing.md,
  },
  errorText: {
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.error,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
  },
});