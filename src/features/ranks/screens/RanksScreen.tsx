import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { colors } from '@/config/theme/colors';
import { theme } from '@/config/theme';

export const RanksScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>🏆</Text>
        </View>
        <Text style={styles.title}>Ranks</Text>
        <Text style={styles.sub}>Leaderboards & achievements coming soon</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.turquoiseTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  icon: { fontSize: 32 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: theme.spacing.sm },
  sub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
});
