import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';
import { colors } from '@/config/theme/colors';

export const TargetPoseCard: React.FC = () => (
  <View style={styles.card}>
    <Text style={styles.label}>TARGET</Text>
    <Svg width={60} height={78} viewBox="0 0 60 78" fill="none">
      <Line x1="30" y1="10" x2="30" y2="22" stroke="#69767A" strokeWidth={2} />
      <Line x1="30" y1="22" x2="12" y2="14" stroke="#69767A" strokeWidth={2} />
      <Line x1="12" y1="14" x2="6" y2="30" stroke="#69767A" strokeWidth={2} />
      <Line x1="30" y1="22" x2="44" y2="30" stroke="#69767A" strokeWidth={2} />
      <Line x1="30" y1="22" x2="30" y2="44" stroke="#69767A" strokeWidth={2} />
      <Line x1="30" y1="44" x2="18" y2="50" stroke="#69767A" strokeWidth={2} />
      <Line x1="30" y1="44" x2="42" y2="50" stroke="#69767A" strokeWidth={2} />
      <Line x1="18" y1="50" x2="16" y2="68" stroke="#69767A" strokeWidth={2} />
      <Line x1="42" y1="50" x2="44" y2="68" stroke="#69767A" strokeWidth={2} />
      <Circle cx="30" cy="10" r={5} fill="#33403F" />
      <Circle cx="30" cy="22" r={2.5} fill="#33403F" />
      <Circle cx="12" cy="14" r={2.5} fill="#33403F" />
      <Circle cx="6" cy="30" r={2.5} fill="#33403F" />
      <Circle cx="44" cy="30" r={2.5} fill="#33403F" />
      <Circle cx="30" cy="44" r={2.5} fill="#33403F" />
      <Circle cx="18" cy="50" r={2.5} fill="#33403F" />
      <Circle cx="42" cy="50" r={2.5} fill="#33403F" />
      <Circle cx="16" cy="68" r={2.5} fill="#33403F" />
      <Circle cx="44" cy="68" r={2.5} fill="#33403F" />
    </Svg>
  </View>
);

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    top: 96,
    right: 16,
    zIndex: 20,
    width: 92,
    height: 124,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  label: {
    fontSize: 8,
    letterSpacing: 1.0,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: 4,
  },
});
