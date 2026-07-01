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
import Svg, { Circle, Line } from 'react-native-svg';
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
import { MovementSegment, SegmentType } from '../types/motion.types';

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

const SEGMENT_LABELS: Record<SegmentType, string> = {
  preparation: 'Preparation',
  arm_wave: 'Arm Wave',
  body_wave: 'Body Wave',
  footwork: 'Footwork',
  turn: 'Turn',
  freeze: 'Freeze',
  groove: 'Groove',
  isolation: 'Isolation',
  transition: 'Transition',
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
  const done: StepState = 'done';
  const active: StepState = 'active';
  const pending: StepState = 'pending';

  const step1: StepState = videoDownloaded ? done : active;
  const step2: StepState =
    phase === 'extracting' ? (videoDownloaded ? active : pending) : done;
  const step3: StepState =
    phase === 'extracting' ? pending : phase === 'processing' ? active : done;
  const step4: StepState =
    phase === 'extracting' || phase === 'processing' ? pending : phase === 'naming' ? pending : done;
  const step5: StepState =
    phase === 'saving' ? active : phase === 'done' ? done : pending;

  return [
    { label: 'Video downloaded', state: step1 },
    { label: 'Detecting pose keypoints (30 fps)', state: step2 },
    { label: 'Smoothing & compressing stream', state: step3 },
    { label: 'Segmenting movements', state: step4 },
    { label: 'Building your drill', state: step5 },
  ];
}

export const VideoProcessingScreen: React.FC<Props> = ({ route, navigation }) => {
  const { videoUri } = route.params;
  const [phase, setPhase] = useState<Phase>('extracting');
  const [videoDownloaded, setVideoDownloaded] = useState(false);
  const [progress, setProgress] = useState<ExtractionProgress>({ current: 0, total: 0, percent: 0 });
  const [moveName, setMoveName] = useState('My Dance Move');
  const [firstKeyPose, setFirstKeyPose] = useState<PoseFrameResult | null>(null);
  const [segments, setSegments] = useState<MovementSegment[]>([]);
  const extractionResult = useRef<ImportedMoveData | null>(null);

  const progressWidth = useSharedValue(0);
  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%` as any,
  }));

  const pulseOpacity = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulseOpacity.value }));

  useEffect(() => {
    const sineInOut = Easing.bezier(0.45, 0, 0.55, 1);
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 700, easing: sineInOut }),
        withTiming(1, { duration: 700, easing: sineInOut }),
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
          { frameIntervalMs: 33, maxFrames: 1200 },
          (p) => {
            if (cancelled) return;
            if (p.current > 0 && !videoDownloaded) setVideoDownloaded(true);
            setProgress(p);
            progressWidth.value = withTiming(p.percent, { duration: 300, easing: Easing.bezier(0, 0, 0.58, 1) });
          },
        );
        if (cancelled) return;

        setPhase('processing');
        progressWidth.value = withTiming(100, { duration: 300 });

        extractionResult.current = result;
        setFirstKeyPose(result.poses[0] ?? null);
        setSegments(result.motionRepresentation.segments);

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
        ? 'Analysing movement patterns…'
        : progress.total > 0
        ? `Detecting keypoints… ${Math.round(progress.percent)}%`
        : 'Starting…';

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <View style={styles.previewCard}>
            <View style={styles.previewVideo}>
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
    const mr = extractionResult.current?.motionRepresentation;
    const streamFrames = mr?.stream.length ?? 0;
    const rawFrames = extractionResult.current?.frameCount ?? 0;
    const durationSec = Math.round((extractionResult.current?.durationMs ?? 0) / 1000);
    const segmentCount = segments.length;

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backChevron}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>Name Your Move</Text>
          <View style={styles.topSpacer} />
        </View>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.namingContent}>
            <View style={styles.successHeader}>
              <Text style={styles.successIcon}>✅</Text>
              <Text style={styles.successTitle}>Movement captured!</Text>
              <Text style={styles.successSub}>
                {rawFrames} frames → {streamFrames} compressed frames · {segmentCount} segments · {durationSec}s
              </Text>
            </View>

            {/* Movement segments */}
            {segments.length > 0 && (
              <View style={styles.segmentsWrap}>
                <Text style={styles.sectionLabel}>Movement segments</Text>
                {segments.map((seg, i) => (
                  <SegmentRow key={i} segment={seg} index={i} />
                ))}
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
        {step.state === 'done' && <Text style={stepStyles.checkMark}>✓</Text>}
        {step.state === 'active' && <View style={stepStyles.activeDot} />}
      </View>
      <Text style={[stepStyles.label, step.state !== 'pending' && stepStyles.labelBright]}>
        {step.label}
      </Text>
    </View>
  );
}

function SegmentRow({ segment, index }: { segment: MovementSegment; index: number }) {
  const durationSec = (segment.durationMs / 1000).toFixed(1);
  const label = SEGMENT_LABELS[segment.segmentType] ?? segment.segmentType;
  const complexity = segment.complexityScore;
  const complexityLabel =
    complexity < 0.1 ? 'Low' : complexity < 0.3 ? 'Medium' : 'High';

  return (
    <View style={segStyles.row}>
      <View style={segStyles.indexBadge}>
        <Text style={segStyles.indexText}>{index + 1}</Text>
      </View>
      <View style={segStyles.info}>
        <Text style={segStyles.label}>{label}</Text>
        <Text style={segStyles.meta}>{durationSec}s · {complexityLabel} complexity</Text>
      </View>
      {/* Teaching pose thumbnails for this segment */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={segStyles.poseStrip}
      >
        {segment.teachingPoses.slice(0, 3).map((frame, pi) => (
          <View key={pi} style={segStyles.poseThumbnail}>
            <PoseStickmanSvg
              pose={{ keypoints: frame.keypoints, timestamp: frame.timestamp, confidence: frame.confidence }}
              width={36}
              height={68}
              color={C.accent}
            />
          </View>
        ))}
      </ScrollView>
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

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  backChevron: { color: C.text, fontSize: 22, lineHeight: 26, marginTop: -2 },
  topTitle: { color: C.text, fontSize: 14, fontWeight: '800', letterSpacing: -0.1 },
  topSpacer: { width: 34 },
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
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent },
  analyzingText: { color: C.text, fontSize: 10, fontWeight: '700' },

  previewBody: { padding: 18 },
  statusLabel: { fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 12 },
  progressTrack: {
    height: 4, backgroundColor: C.surface2,
    borderRadius: 2, overflow: 'hidden', marginBottom: 14,
  },
  progressFill: { height: '100%', backgroundColor: C.accent, borderRadius: 2 },

  namingContent: { padding: 20, paddingBottom: 40 },
  successHeader: { alignItems: 'center', marginBottom: 24 },
  successIcon: { fontSize: 48, marginBottom: 12 },
  successTitle: {
    color: C.text, fontSize: 22, fontWeight: '900',
    letterSpacing: -0.5, marginBottom: 6,
  },
  successSub: { color: C.textDim, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  segmentsWrap: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
    color: C.textDim, fontWeight: '700', marginBottom: 10,
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
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent },
  checkMark: { color: '#06201D', fontSize: 11, fontWeight: '900' },
  label: { fontSize: 12.5, fontWeight: '600', color: C.textDim },
  labelBright: { color: C.text, fontWeight: '700' },
});

const segStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.surface, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    padding: 10, marginBottom: 8,
  },
  indexBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: C.accentSoft,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  indexText: { color: C.accent, fontSize: 11, fontWeight: '800' },
  info: { flex: 1 },
  label: { color: C.text, fontSize: 13, fontWeight: '700' },
  meta: { color: C.textDim, fontSize: 11, marginTop: 2 },
  poseStrip: { gap: 4 },
  poseThumbnail: {
    width: 44, alignItems: 'center',
    backgroundColor: C.surface2,
    borderRadius: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: C.accentBorder,
  },
});
