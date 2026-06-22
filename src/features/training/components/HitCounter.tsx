import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/config/theme/colors';

interface Props {
  count: number;
}

export const HitCounter: React.FC<Props> = ({ count }) => (
  <View style={styles.card}>
    <Text style={styles.num}>{count}</Text>
    <Text style={styles.label}>HITS</Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    top: 96,
    left: 16,
    zIndex: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  num: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
    lineHeight: 28,
  },
  label: {
    fontSize: 8,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    fontWeight: '700',
    marginTop: 3,
  },
});
