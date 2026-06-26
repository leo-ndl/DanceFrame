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
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { videoPoseExtractor, ImportedMoveData } from '../services/VideoPoseExtractor';
import { movesRepository } from '@/core/data/repositories/MovesRepository';
import { ExtractionProgress } from '@/core/ai/native/VideoProcessorBridge';
import { PoseStickmanSvg } from '@/features/practice/components/PoseStickmanSvg';
import { PoseFrameResult } from '@/core/ai/types/ml.types';

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: '#0A0E0E',
  surface: '#141B1B',
  surface2: '#1B2424',
  text: '#ECEFEE',
  textDim: '#69767A',
  accent: '#1FE0C9',
  accentSoft: 'rgba(31,224,201,0.16)',
  border: 'rgba(236,239,238,0.08)',
  accentBorder: 'rgba(31,224,201,0.3)',
};

interface Props {
  route: { params: { videoUri: string } };
  navigation: any;
}

type Phase = 'extracting' | 'processing' | 'naming' | 'saving' | 'done';

type StepState = 'done' | 'active' | 'pending';

interface Step {
  label: string;
  state: StepState;
}

function stepsForPhase(phase: Phase, videoDownloaded: boolean): Step[] {
  if (phase === 'extracting') {
    return [
      { label: 'Video downloaded', state: videoDownloaded ? 'done' : 'active' },
      { label: 'Detecting pose keypoints', state: videoDownloaded ? 'active' : 'pending' },
      { label: 'Extracting key poses', state: 'pending' },
      { label: 'Building your drill', state: 'pending' },
    ];
  }
  if (phase === 'processing') {
    return [
      { label: 'Video downloaded', state: 'done' },
      { label: 'Detecting pose keypoints', state: 'done' },
      { label: 'Extracting key poses', state: 'active' },
      { label: 'Building your drill', state: 'pending' },
    ];
  }
  if (phase === 'naming') {
    return [
      { label: 'Video downloaded', state: 'done' },
      { label: 'Detecting pose keypoints', state: 'done' },
      { label: 'Extracting key poses', state: 'done' },
      { label: 'Building your drill', state: 'pending' },
    ];
  }
  // saving / done
  return [
    { label: 'Video downloaded', state: 'done' },
    { label: 'Detecting pose keypoints', state: 'done' },
    { label: 'Extracting key poses', state: 'done' },
    { label: 'Building your drill', state: phase === 'done' ? 'done' : 'active' },
  ];
}

export const VideoProcessingScreen: React.FC<Props> = ({ route, navigation }) => {
  const { videoUri } = route.params;
  const [phase, setPhase] = useState<Phase>('extracting');
  const [videoDownloaded, setVideoDownloaded] = useState(false);
  const [progress, setProgress] = useState<ExtractionProgress>({ current: 0, total: 0, percent: 0 });
  const [moveName, setMoveName] = useState('My Dance Move');
  const [firstKeyPose, setFirstKeyPose] = useState<PoseFrameResult | null>(null);
  const [keyPoses, setKeyPoses] = useState<PoseFrameResult[]>([]);
  const extractionResult = useRef<ImportedMoveData | null>(null);

  const progressWidth = useSharedValue(0);
  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%` as any,
  }));

  const pulseOpacity = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulseOpacity.value }));

  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 700, easing: Easing.inOut(Easing.sine) }),
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sine) }),
      ),
      -1,
      false,
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const result = await videoPoseExtractor.extractFromVideo(
          videoUri,
          { frameIntervalMs: 200, maxFrames: 500 },
          (p) => {
            if (cancelled) return;
            if (p.current > 0 && !videoDownloaded) setVideoDownloaded(true);
            setProgress(p);
            progressWidth.value = withTiming(p.percent, { duration: 300, easing: Easing.out(Easing.quad) });
          },
        );
        if (cancelled) return;

        // Brief 'processing' phase so UI shows step 3 active.
        setPhase('processing');
        progressWidth.value = withTiming(100, { duration: 300 });

        extractionResult.current = result;
        setFirstKeyPose(result.poses[0] ?? null);
        setKeyPoses(result.poses);

        // Yield one frame so the UI renders the processing state before naming.
        await new Promise<void>(resolve => setTimeout(resolve, 400));
        if (cancelled) return;

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
      setTimeout(() => navigation.navigate('Practice', { moveId: move.id }), 600);
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message ?? 'Could not save move');
      setPhase('naming');
    }
  };

  // ── Rendering ────────────────────────────────────────────────────────────────

  if (phase === 'extracting' || phase === 'processing') {
    const steps = stepsForPhase(phase, videoDownloaded);
    const statusLabel =
      phase === 'processing'
        ? 'Extracting key poses…'
        : progress.total > 0
        ? `Detecting keypoints… ${Math.round(progress.percent)}%`
        : 'Starting…';

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          {/* Stickman preview card */}
          <View style={styles.previewCard}>
            <View style={styles.previewVideo}>
              <GridOverlay />
              {firstKeyPose ? (
                <PoseStickmanSvg
                  pose={firstKeyPose}
                  width={70}
                  height={160}
                  color={C.accent}
                />
              ) : (
                <PlaceholderSkeleton pulseStyle={pulseStyle} />
              )}
              <View style={styles.analyzingBadge}>
                <Animated.View style={[styles.pulseDot, pulseStyle]} />
                <Text style={styles.analyzingText}>Analyzing</Text>
              </View>
            </View>

            <View style={styles.previewBody}>
              <Text style={styles.statusLabel}>{statusLabel}</Text>

              {/* Progress bar (visible during extraction) */}
              {phase === 'extracting' && (
                <View style={styles.progressTrack}>
                  <Animated.View style={[styles.progressFill, progressStyle]} />
                </View>
              )}

              {steps.map((step, i) => (
                <StepRow key={i} step={step} />
              ))}
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'naming') {
    const keyPoseCount = extractionResult.current?.keyPoseCount ?? 0;
    const durationSec = Math.round((extractionResult.current?.durationMs ?? 0) / 1000);
    const rawFrames = extractionResult.current?.frameCount ?? 0;

    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.namingContent}>
            <View style={styles.successHeader}>
              <Text style={styles.successIcon}>✅</Text>
              <Text style={styles.successTitle}>Key poses extracted!</Text>
              <Text style={styles.successSub}>
                Distilled {rawFrames} frames → {keyPoseCount} key poses from a {durationSec}s video
              </Text>
            </View>

            {/* Key pose thumbnail strip */}
            {keyPoses.length > 0 && (
              <View style={styles.poseStripWrap}>
                <Text style={styles.sectionLabel}>Key pose sequence</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.poseStrip}
                >
                  {keyPoses.map((pose, i) => (
                    <View key={i} style={styles.poseThumbnail}>
                      <PoseStickmanSvg
                        pose={pose}
                        width={48}
                        height={90}
                        color={C.accent}
                      />
                      <Text style={styles.poseIndex}>{i + 1}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.nameContainer}>
              <Text style={styles.nameLabel}>Name this move</Text>
              <TextInput
                style={styles.nameInput}
                value={moveName}
                onChangeText={setMoveName}
                placeholder="e.g. TikTok Wave Move"
                placeholderTextColor={C.textDim}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>🕺  Start Practicing</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // saving / done
  const steps = stepsForPhase(phase, true);
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centered}>
        <View style={styles.previewCard}>
          <View style={[styles.previewVideo, styles.previewVideoDone]}>
            {firstKeyPose ? (
              <PoseStickmanSvg pose={firstKeyPose} width={70} height={160} color={C.accent} />
            ) : null}
          </View>
          <View style={styles.previewBody}>
            <Text style={styles.statusLabel}>
              {phase === 'done' ? 'Ready to practice! 🎉' : 'Building your drill…'}
            </Text>
            {steps.map((step, i) => (
              <StepRow key={i} step={step} />
            ))}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StepRow({ step }: { step: { label: string; state: StepState } }) {
  return (
    <View style={stepStyles.row}>
      <View style={[stepStyles.check, stepStyles[step.state]]}>
        {step.state === 'done' && (
          <Text style={stepStyles.checkMark}>✓</Text>
        )}
        {step.state === 'active' && <View style={stepStyles.activeDot} />}
      </View>
      <Text style={[stepStyles.label, step.state !== 'pending' && stepStyles.labelBright]}>
        {step.label}
      </Text>
    </View>
  );
}

function PlaceholderSkeleton({ pulseStyle }: { pulseStyle: any }) {
  return (
    <Animated.View style={[{ width: 70, height: 160 }, pulseStyle]}>
      <Svg width={70} height={160} viewBox="0 0 70 160" fill="none">
        <Line x1="35" y1="18" x2="35" y2="40" stroke={C.accent} strokeWidth={2.5} />
        <Line x1="35" y1="40" x2="14" y2="32" stroke={C.accent} strokeWidth={2.5} />
        <Line x1="35" y1="40" x2="56" y2="32" stroke={C.accent} strokeWidth={2.5} />
        <Line x1="35" y1="40" x2="35" y2="86" stroke={C.accent} strokeWidth={2.5} />
        <Line x1="35" y1="86" x2="22" y2="96" stroke={C.accent} strokeWidth={2.5} />
        <Line x1="35" y1="86" x2="48" y2="96" stroke={C.accent} strokeWidth={2.5} />
        <Line x1="22" y1="96" x2="20" y2="140" stroke={C.accent} strokeWidth={2.5} />
        <Line x1="48" y1="96" x2="50" y2="140" stroke={C.accent} strokeWidth={2.5} />
        <Circle cx="35" cy="18" r="9" fill={C.accent} opacity={0.9} />
        <Circle cx="14" cy="32" r="4" fill={C.accent} />
        <Circle cx="56" cy="32" r="4" fill={C.accent} />
        <Circle cx="22" cy="96" r="4" fill={C.accent} />
        <Circle cx="48" cy="96" r="4" fill={C.accent} />
        <Circle cx="20" cy="140" r="4" fill={C.accent} />
        <Circle cx="50" cy="140" r="4" fill={C.accent} />
      </Svg>
    </Animated.View>
  );
}

function GridOverlay() {
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },

  previewCard: {
    width: '100%',
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 18, overflow: 'hidden',
  },
  previewVideo: {
    height: 200,
    backgroundColor: '#1C2727',
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  previewVideoDone: { opacity: 0.7 },
  analyzingBadge: {
    position: 'absolute', top: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(10,14,14,0.7)',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8,
  },
  pulseDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: C.accent,
  },
  analyzingText: { color: C.text, fontSize: 10, fontWeight: '700' },

  previewBody: { padding: 18 },
  statusLabel: { fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 12 },
  progressTrack: {
    height: 4, backgroundColor: C.surface2,
    borderRadius: 2, overflow: 'hidden', marginBottom: 14,
  },
  progressFill: {
    height: '100%', backgroundColor: C.accent, borderRadius: 2,
  },

  // Naming phase
  namingContent: { padding: 20, paddingBottom: 40 },
  successHeader: { alignItems: 'center', marginBottom: 24 },
  successIcon: { fontSize: 48, marginBottom: 12 },
  successTitle: {
    color: C.text, fontSize: 22, fontWeight: '900',
    letterSpacing: -0.5, marginBottom: 6,
  },
  successSub: { color: C.textDim, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  poseStripWrap: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
    color: C.textDim, fontWeight: '700', marginBottom: 10,
  },
  poseStrip: { gap: 8, paddingVertical: 4 },
  poseThumbnail: {
    width: 56, alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: C.accentBorder,
  },
  poseIndex: {
    color: C.textDim, fontSize: 10, fontWeight: '700', marginTop: 4,
  },

  nameContainer: { marginBottom: 20 },
  nameLabel: { color: C.textDim, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  nameInput: {
    backgroundColor: C.surface,
    borderRadius: 12, borderWidth: 1, borderColor: C.accentBorder,
    color: C.text, fontSize: 15, padding: 14,
  },
  saveBtn: {
    backgroundColor: C.accent, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
  },
  saveBtnText: { color: '#06201D', fontSize: 15, fontWeight: '800' },
});

const stepStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  check: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  done: { backgroundColor: C.accent },
  active: { borderWidth: 2, borderColor: C.accent, backgroundColor: 'transparent' },
  pending: { borderWidth: 2, borderColor: C.border, backgroundColor: 'transparent' },
  activeDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent,
  },
  checkMark: { color: '#06201D', fontSize: 11, fontWeight: '900' },
  label: { fontSize: 12.5, fontWeight: '600', color: C.textDim },
  labelBright: { color: C.text, fontWeight: '700' },
});
