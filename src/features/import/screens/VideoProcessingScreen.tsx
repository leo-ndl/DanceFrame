import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors } from '@/config/theme/colors';
import { spacing } from '@/config/theme/spacing';
import { typography } from '@/config/theme/typography';
import { videoPoseExtractor } from '../services/VideoPoseExtractor';
import { movesRepository } from '@/core/data/repositories/MovesRepository';
import { ExtractionProgress } from '@/core/ai/native/VideoProcessorBridge';

interface Props {
  route: { params: { videoUri: string } };
  navigation: any;
}

type Phase = 'extracting' | 'naming' | 'saving' | 'done';

export const VideoProcessingScreen: React.FC<Props> = ({ route, navigation }) => {
  const { videoUri } = route.params;
  const [phase, setPhase] = useState<Phase>('extracting');
  const [progress, setProgress] = useState<ExtractionProgress>({ current: 0, total: 0, percent: 0 });
  const [moveName, setMoveName] = useState('My Dance Move');
  const extractionResult = useRef<Awaited<ReturnType<typeof videoPoseExtractor.extractFromVideo>> | null>(null);

  const progressWidth = useSharedValue(0);
  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%` as any,
  }));

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const result = await videoPoseExtractor.extractFromVideo(
          videoUri,
          { frameIntervalMs: 200, maxFrames: 500 },
          (p) => {
            if (cancelled) return;
            setProgress(p);
            progressWidth.value = withTiming(p.percent, { duration: 300, easing: Easing.out(Easing.quad) });
          },
        );
        if (cancelled) return;
        extractionResult.current = result;
        progressWidth.value = withTiming(100, { duration: 300 });
        setPhase('naming');
      } catch (err: any) {
        if (cancelled) return;
        Alert.alert('Extraction Failed', err?.message ?? 'Could not process video', [
          { text: 'Go Back', onPress: () => navigation.goBack() },
        ]);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [videoUri]);

  const handleSave = async () => {
    if (!extractionResult.current) return;
    const name = moveName.trim() || 'My Dance Move';
    setPhase('saving');
    try {
      const move = await movesRepository.saveImportedMove(extractionResult.current, name);
      setPhase('done');
      setTimeout(() => navigation.navigate('Practice', { moveId: move.id }), 500);
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message ?? 'Could not save move');
      setPhase('naming');
    }
  };

  if (phase === 'extracting') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.icon}>🤖</Text>
          <Text style={styles.heading}>Extracting Poses</Text>
          <Text style={styles.subheading}>
            AI is analyzing every frame of your video…
          </Text>

          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, progressStyle]} />
          </View>

          <Text style={styles.progressLabel}>
            {progress.total > 0
              ? `${progress.current} / ${progress.total} frames  (${Math.round(progress.percent)}%)`
              : 'Starting…'}
          </Text>

          <Text style={styles.hint}>
            This may take 30–60 seconds depending on video length.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'naming') {
    const frameCount = extractionResult.current?.frameCount ?? 0;
    const durationSec = Math.round((extractionResult.current?.durationMs ?? 0) / 1000);
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.centered}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Text style={styles.icon}>✅</Text>
          <Text style={styles.heading}>Extraction Complete!</Text>
          <Text style={styles.subheading}>
            Captured {frameCount} pose frames from a {durationSec}s video.
          </Text>

          <View style={styles.nameContainer}>
            <Text style={styles.label}>Name this move</Text>
            <TextInput
              style={styles.input}
              value={moveName}
              onChangeText={setMoveName}
              placeholder="e.g. TikTok Wave Move"
              placeholderTextColor={colors.textSecondary}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>🕺  Start Practicing</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centered}>
        <Text style={styles.icon}>{phase === 'done' ? '🎉' : '💾'}</Text>
        <Text style={styles.heading}>
          {phase === 'done' ? 'Ready to Practice!' : 'Saving Move…'}
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  icon: { fontSize: 64, marginBottom: spacing.lg },
  heading: {
    color: colors.text,
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subheading: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  progressTrack: {
    width: '100%',
    height: 12,
    backgroundColor: colors.surface,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary[500],
    borderRadius: 6,
  },
  progressLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.xs,
    marginBottom: spacing.lg,
  },
  hint: {
    color: colors.gray[600],
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
  },
  nameContainer: {
    width: '100%',
    marginBottom: spacing.xl,
  },
  label: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary[700],
    color: colors.text,
    fontSize: typography.fontSize.base,
    padding: spacing.md,
  },
  saveBtn: {
    backgroundColor: colors.primary[600],
    borderRadius: 14,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  saveBtnText: {
    color: colors.text,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
});
