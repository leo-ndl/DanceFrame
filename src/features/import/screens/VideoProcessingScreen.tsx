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
import Svg, { Rect } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { videoImportProcessor, ImportedVideoData } from '../services/VideoImportProcessor';
import { movesRepository } from '@/core/data/repositories/MovesRepository';
import { BeatSegment } from '../types/beatSegment.types';
import { getExtractionErrorInfo } from '../constants/extractionErrors';

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
  warn: '#FF6B4A',
  warnSoft: 'rgba(255,107,74,0.12)',
  warnBorder: 'rgba(255,107,74,0.3)',
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

function stepsForPhase(phase: Phase): Step[] {
  const done: StepState = 'done';
  const active: StepState = 'active';
  const pending: StepState = 'pending';

  const step1: StepState = phase === 'extracting' ? active : done;
  const step2: StepState = phase === 'extracting' ? pending : phase === 'processing' ? active : done;
  const step3: StepState = phase === 'saving' ? active : phase === 'done' ? done : pending;

  return [
    { label: 'Importing video & analysing audio', state: step1 },
    { label: 'Detecting beats', state: step2 },
    { label: 'Building your drill', state: step3 },
  ];
}

export const VideoProcessingScreen: React.FC<Props> = ({ route, navigation }) => {
  const { videoUri } = route.params;
  const [phase, setPhase] = useState<Phase>('extracting');
  const [moveName, setMoveName] = useState('My Dance Move');
  const [segments, setSegments] = useState<BeatSegment[]>([]);
  const extractionResult = useRef<ImportedVideoData | null>(null);

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
        const result = await videoImportProcessor.processVideo(videoUri);
        if (cancelled) return;

        setPhase('processing');
        extractionResult.current = result;
        setSegments(result.segments);

        await new Promise<void>(resolve => setTimeout(resolve, 400));
        if (cancelled) return;

        setPhase('naming');
      } catch (err: any) {
        if (cancelled) return;
        const info = getExtractionErrorInfo(err);
        if (info.silent) {
          navigation.goBack();
          return;
        }
        Alert.alert(info.title, info.message, [
          { text: 'Go Back', onPress: () => navigation.goBack() },
        ]);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [videoUri]);

  const handleRenameSegment = (index: number, label: string) => {
    setSegments(prev => prev.map((seg, i) => (i === index ? { ...seg, label } : seg)));
  };

  const handleSave = async () => {
    if (!extractionResult.current) return;
    const name = moveName.trim() || 'My Dance Move';
    setPhase('saving');
    try {
      const move = await movesRepository.saveImportedMove(
        { ...extractionResult.current, segments },
        name,
      );
      setPhase('done');
      setTimeout(() => navigation.navigate('VideoPractice', { moveId: move.id }), 600);
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message ?? 'Could not save move');
      setPhase('naming');
    }
  };

  // ── Rendering ────────────────────────────────────────────────────────────────

  if (phase === 'extracting' || phase === 'processing') {
    const steps = stepsForPhase(phase);
    const statusLabel = phase === 'processing' ? 'Detecting beats…' : 'Importing & analysing audio…';

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <View style={styles.previewCard}>
            <View style={styles.previewVideo}>
              <PlaceholderWaveform pulseStyle={pulseStyle} />
              <View style={styles.analyzingBadge}>
                <Animated.View style={[styles.pulseDot, pulseStyle]} />
                <Text style={styles.analyzingText}>Analyzing</Text>
              </View>
            </View>

            <View style={styles.previewBody}>
              <Text style={styles.statusLabel}>{statusLabel}</Text>
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
    const durationSec = Math.round((extractionResult.current?.durationMs ?? 0) / 1000);
    const segmentCount = segments.length;
    const fewSegments = segmentCount <= 1;

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
                {durationSec}s · {segmentCount} {segmentCount === 1 ? 'segment' : 'segments'}
              </Text>
            </View>

            {fewSegments && (
              <View style={styles.warningBanner}>
                <Text style={styles.warningText}>
                  ⚠️ We couldn't detect clear beats in this video's audio — you can still practice, just without auto-segmentation.
                </Text>
              </View>
            )}

            {/* Beat segments */}
            {segments.length > 0 && (
              <View style={styles.segmentsWrap}>
                <Text style={styles.sectionLabel}>Segments</Text>
                {segments.map((seg, i) => (
                  <SegmentRow key={i} segment={seg} index={i} onRename={handleRenameSegment} />
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
  const steps = stepsForPhase(phase);
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centered}>
        <View style={styles.previewCard}>
          <View style={[styles.previewVideo, styles.previewVideoDone]}>
            <PlaceholderWaveform pulseStyle={pulseStyle} />
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

function SegmentRow({
  segment,
  index,
  onRename,
}: {
  segment: BeatSegment;
  index: number;
  onRename: (index: number, label: string) => void;
}) {
  const durationSec = ((segment.endMs - segment.startMs) / 1000).toFixed(1);

  return (
    <View style={segStyles.row}>
      <View style={segStyles.indexBadge}>
        <Text style={segStyles.indexText}>{index + 1}</Text>
      </View>
      <View style={segStyles.info}>
        <TextInput
          style={segStyles.labelInput}
          value={segment.label}
          onChangeText={t => onRename(index, t)}
        />
        <Text style={segStyles.meta}>{durationSec}s</Text>
      </View>
    </View>
  );
}

function PlaceholderWaveform({ pulseStyle }: { pulseStyle: any }) {
  const bars = [22, 40, 60, 44, 30, 52, 36];
  return (
    <Animated.View style={pulseStyle}>
      <Svg width={70} height={70} viewBox="0 0 70 70" fill="none">
        {bars.map((h, i) => (
          <Rect
            key={i}
            x={i * 10}
            y={(70 - h) / 2}
            width={6}
            height={h}
            rx={3}
            fill={C.accent}
          />
        ))}
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

  namingContent: { padding: 20, paddingBottom: 40 },
  successHeader: { alignItems: 'center', marginBottom: 24 },
  successIcon: { fontSize: 48, marginBottom: 12 },
  successTitle: {
    color: C.text, fontSize: 22, fontWeight: '900',
    letterSpacing: -0.5, marginBottom: 6,
  },
  successSub: { color: C.textDim, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  warningBanner: {
    backgroundColor: C.warnSoft,
    borderWidth: 1, borderColor: C.warnBorder,
    borderRadius: 12, padding: 12, marginBottom: 20,
  },
  warningText: { color: C.text, fontSize: 12.5, lineHeight: 18, fontWeight: '600' },

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
  labelInput: { color: C.text, fontSize: 13, fontWeight: '700', padding: 0 },
  meta: { color: C.textDim, fontSize: 11, marginTop: 2 },
});
