import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/config/theme/colors';

const BAR_HEIGHTS = [34, 24, 30, 16, 20, 12, 18, 10];
const BEAT_INTERVAL_MS = 500; // 120 BPM

interface Props {
  isActive: boolean;
}

export const BeatVisualizer: React.FC<Props> = ({ isActive }) => {
  const [beatPhase, setBeatPhase] = useState(0);

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => {
      setBeatPhase(prev => (prev + 1) % BAR_HEIGHTS.length);
    }, BEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isActive]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>ON THE BEAT</Text>
      <View style={styles.barsRow}>
        {BAR_HEIGHTS.map((h, i) => {
          const isHit = i <= beatPhase;
          return (
            <View
              key={i}
              style={[
                styles.bar,
                { height: h },
                isHit ? styles.barHit : styles.barUpcoming,
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
    height: 34,
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
  barUpcoming: {
    backgroundColor: 'rgba(236,239,238,0.3)',
  },
});
