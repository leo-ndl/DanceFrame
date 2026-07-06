import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/config/theme/colors';
import { spacing } from '@/config/theme/spacing';
import { typography } from '@/config/theme/typography';
import { ScoreHero } from '@/features/practice/components/ScoreHero';
import { CompletedDrillResult } from '../types/training.types';
import { BurstCelebration } from './BurstCelebration';

// Heuristic-mode drills have no ground truth to compare against, so we never
// fabricate a technique-accuracy number for them — instead we reflect the
// combo streak actually achieved (a real, honest signal) as a qualitative label.
function heuristicLabel(bestCombo: number): string {
  if (bestCombo >= 20) return 'Incredible Energy!';
  if (bestCombo >= 10) return 'Great Energy!';
  if (bestCombo >= 5) return 'Nice Movement!';
  return 'Keep Grooving';
}

interface Props {
  drillName: string;
  result: CompletedDrillResult | null;
}

// Brief per-drill celebration shown during the 'drillComplete' phase, between
// a drill ending and the next break/drill starting. Distinct from the
// full-session ResultsScreen (single-move Practice flow) — this is condensed
// and reuses ScoreHero's visual language rather than a full breakdown.
export const DrillCompleteOverlay: React.FC<Props> = ({ drillName, result }) => {
  if (!result) return null;

  const isCompared = result.scoreMode === 'compared' && result.avgScore !== null;

  return (
    <View style={styles.container} pointerEvents="none">
      <BurstCelebration active={result.isNewBest} />

      {isCompared ? (
        <ScoreHero score={result.avgScore as number} subtitle={drillName} />
      ) : (
        <View style={styles.qualitativeHero}>
          <Text style={styles.qualitativeLabel}>{heuristicLabel(result.bestCombo)}</Text>
          <Text style={styles.drillName}>{drillName}</Text>
        </View>
      )}

      {result.bestCombo > 1 && (
        <Text style={styles.comboLine}>Best streak ×{result.bestCombo}</Text>
      )}
      {result.isNewBest && <Text style={styles.newBestLine}>🏆 New Personal Best!</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,14,14,0.82)',
  },
  qualitativeHero: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
  },
  qualitativeLabel: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[500],
    marginBottom: spacing.xs,
  },
  drillName: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.semibold,
  },
  comboLine: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    marginTop: spacing.sm,
  },
  newBestLine: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning,
    marginTop: spacing.md,
  },
});
