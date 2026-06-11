import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { colors } from '@/config/theme/colors';
import { spacing } from '@/config/theme/spacing';
import { typography } from '@/config/theme/typography';
import { videoPoseExtractor } from '../services/VideoPoseExtractor';

interface Props {
  navigation: any;
}

export const VideoImportScreen: React.FC<Props> = ({ navigation }) => {
  const [isPicking, setIsPicking] = useState(false);

  const handlePickVideo = async () => {
    if (!videoPoseExtractor.isAvailable()) {
      Alert.alert('Not Available', 'Video import is not supported on this device.');
      return;
    }

    setIsPicking(true);
    try {
      const videoUri = await videoPoseExtractor.pickVideo();
      navigation.navigate('VideoProcessing', { videoUri });
    } catch (err: any) {
      if (err?.code !== 'E_PICKER_CANCELLED') {
        Alert.alert('Error', err?.message ?? 'Failed to pick video');
      }
    } finally {
      setIsPicking(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Import Dance Video</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🎬</Text>
        </View>

        <Text style={styles.heading}>Learn Any Dance Move</Text>
        <Text style={styles.description}>
          Import a dance video from TikTok or your gallery. The app will extract
          the dancer's pose from each frame and create a personalized practice
          session for you to follow along.
        </Text>

        <View style={styles.steps}>
          {[
            { emoji: '📱', text: 'Save the TikTok video to your Photos' },
            { emoji: '📂', text: 'Pick it from your gallery below' },
            { emoji: '🤖', text: 'AI extracts pose data from every frame' },
            { emoji: '🕺', text: 'Practice with real-time coaching' },
          ].map((step, i) => (
            <View key={i} style={styles.step}>
              <Text style={styles.stepEmoji}>{step.emoji}</Text>
              <Text style={styles.stepText}>{step.text}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.importBtn, isPicking && styles.importBtnDisabled]}
          onPress={handlePickVideo}
          disabled={isPicking}
        >
          <Text style={styles.importBtnText}>
            {isPicking ? 'Opening Gallery…' : '📂  Pick Video from Gallery'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    paddingTop: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    marginRight: spacing.md,
  },
  backText: {
    color: colors.primary[400],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  title: {
    color: colors.text,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  body: {
    flex: 1,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary[900],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  icon: {
    fontSize: 48,
  },
  heading: {
    color: colors.text,
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  steps: {
    width: '100%',
    marginBottom: spacing.xl,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepEmoji: {
    fontSize: 22,
    marginRight: spacing.md,
  },
  stepText: {
    color: colors.text,
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  importBtn: {
    backgroundColor: colors.primary[600],
    borderRadius: 14,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  importBtnDisabled: {
    opacity: 0.6,
  },
  importBtnText: {
    color: colors.text,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
});
