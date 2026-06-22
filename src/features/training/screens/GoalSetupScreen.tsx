import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors } from '@/config/theme/colors';
import { spacing } from '@/config/theme/spacing';
import { typography } from '@/config/theme/typography';
import { DanceStyle } from '../types/training.types';
import { Difficulty } from '@/shared/types/common.types';
import { generateTrainingPlan } from '../services/PlanGenerator';
import { useAppStore } from '@/core/state/store';
import { GEMINI_API_KEY } from '@/config/env';

interface Props {
  navigation: any;
}

interface StyleOption {
  id: DanceStyle;
  emoji: string;
  tagline: string;
}

const STYLE_OPTIONS: StyleOption[] = [
  { id: 'Popping',   emoji: '💥', tagline: 'Muscle hits & control' },
  { id: 'HipHop',   emoji: '🎤', tagline: 'Grooves & swag' },
  { id: 'Locking',  emoji: '🔒', tagline: 'Funk & soul' },
  { id: 'Animation',emoji: '🤖', tagline: 'Slow-mo illusions' },
  { id: 'House',    emoji: '🏠', tagline: 'Footwork & energy' },
  { id: 'Krump',    emoji: '👊', tagline: 'Raw power & expression' },
];

const LEVELS: Difficulty[] = ['Beginner', 'Intermediate', 'Advanced'];

export const GoalSetupScreen: React.FC<Props> = ({ navigation }) => {
  const [selectedStyle, setSelectedStyle] = useState<DanceStyle | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<Difficulty | null>(null);
  const [loading, setLoading] = useState(false);
  const setActivePlan = useAppStore(state => state.setActivePlan);

  const canGenerate = selectedStyle !== null && selectedLevel !== null;

  const handleGenerate = async () => {
    if (!selectedStyle || !selectedLevel) return;
    setLoading(true);
    try {
      const plan = await generateTrainingPlan(selectedStyle, selectedLevel, GEMINI_API_KEY);
      setActivePlan(plan);
      navigation.replace('TrainingPlan');
    } catch (e) {
      Alert.alert('Error', 'Failed to generate plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backBtn}>← Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Choose Your Style</Text>
        <Text style={styles.subtitle}>We'll build a personal 30-day plan for you</Text>

        {/* Style grid */}
        <View style={styles.grid}>
          {STYLE_OPTIONS.map(opt => {
            const selected = selectedStyle === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.styleCard, selected && styles.styleCardSelected]}
                onPress={() => setSelectedStyle(opt.id)}
                activeOpacity={0.75}
              >
                <Text style={styles.styleEmoji}>{opt.emoji}</Text>
                <Text style={[styles.styleName, selected && styles.styleNameSelected]}>{opt.id}</Text>
                <Text style={styles.styleTagline}>{opt.tagline}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Level */}
        <Text style={styles.sectionTitle}>Your Level</Text>
        <View style={styles.levelRow}>
          {LEVELS.map(level => {
            const selected = selectedLevel === level;
            return (
              <TouchableOpacity
                key={level}
                style={[styles.levelBtn, selected && styles.levelBtnSelected]}
                onPress={() => setSelectedLevel(level)}
                activeOpacity={0.75}
              >
                <Text style={[styles.levelText, selected && styles.levelTextSelected]}>{level}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.generateBtn, !canGenerate && styles.generateBtnDisabled]}
          onPress={handleGenerate}
          disabled={!canGenerate || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.generateBtnText}>  Crafting your plan…</Text>
            </View>
          ) : (
            <Text style={styles.generateBtnText}>Generate My Plan</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.footerNote}>Powered by Gemini AI · 30-day program</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing['3xl'] },
  header: { marginBottom: spacing.lg },
  backBtn: { color: colors.textSecondary, fontSize: typography.fontSize.base },
  title: {
    color: colors.text,
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.base,
    marginBottom: spacing.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  styleCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  styleCardSelected: {
    borderColor: colors.primary[500],
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
  },
  styleEmoji: { fontSize: 32, marginBottom: spacing.xs },
  styleName: {
    color: colors.text,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 2,
  },
  styleNameSelected: { color: colors.primary[400] },
  styleTagline: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.md,
  },
  levelRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  levelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  levelBtnSelected: {
    borderColor: colors.primary[500],
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
  },
  levelText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  levelTextSelected: { color: colors.primary[400] },
  generateBtn: {
    backgroundColor: colors.primary[600],
    borderRadius: 16,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  generateBtnDisabled: { opacity: 0.45 },
  generateBtnText: {
    color: colors.text,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center' },
  footerNote: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
  },
});
