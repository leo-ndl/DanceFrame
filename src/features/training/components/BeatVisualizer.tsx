import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/config/theme/colors';

const BAR_HEIGHTS = [34, 24, 30, 16, 20, 12, 18, 10];
const BEAT_INTERVAL_MS = 500; // 120 BPM — decorative pacing base; TrainingDrill
// carries no BPM field the way Move does, so this isn't synced to real
// per-drill tempo. Accepted simplification — see plan Phase F.
const SYNC_LOSS_OPACITY_THRESHOLD = 0.35; // mirrors useRollingAnalysis's SYNC_LOSS_THRESHOLD

interface Props {
  isActive: boolean;
  /** Pulses true for a moment when a real hit is registered (works in both
   * compared and heuristic scoring modes). */
  justHit?: boolean;
  /** 0-1 sync confidence from useRollingAnalysis — only present in compared
   * mode. When it drops below the sync-loss threshold, the row dims. */
  syncConfidence?: number;
}

export const BeatVisualizer: React.FC<Props> = ({ isActive, justHit = false, syncConfidence }) => {
  const [beatPhase, setBeatPhase] = useState(0);

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => {
      setBeatPhase(prev => (prev + 1) % BAR_HEIGHTS.length);
    }, BEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isActive]);

  const isOffSync = syncConfidence !== undefined && syncConfidence < SYNC_LOSS_OPACITY_THRESHOLD;

  return (
    <View style={[styles.container, isOffSync && styles.containerOffSync]}>
      <Text style={styles.label}>{isOffSync ? 'FIND THE SYNC' : 'ON THE BEAT'}</Text>
      <View style={styles.barsRow}>
        {BAR_HEIGHTS.map((h, i) => {
          const isHit = i <= beatPhase;
          return (
            <View
              key={i}
              style={[
                styles.bar,
                { height: justHit && isHit ? h * 1.25 : h },
                isHit ? (justHit ? styles.barJustHit : styles.barHit) : styles.barUpcoming,
              ]}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 226,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  containerOffSync: {
    opacity: 0.45,
  },
  label: {
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: 6,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    height: 42,
  },
  bar: {
    width: 5,
    borderRadius: 3,
  },
  barHit: {
    backgroundColor: colors.primary[500],
    shadowColor: colors.primary[500],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 5,
  },
  barJustHit: {
    backgroundColor: colors.primary[400],
    shadowColor: colors.primary[400],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  barUpcoming: {
    backgroundColor: 'rgba(236,239,238,0.3)',
  },
});
