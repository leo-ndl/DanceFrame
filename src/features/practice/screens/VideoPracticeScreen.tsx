import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';
import { Camera } from 'react-native-vision-camera';
import Video from 'react-native-video';
import Slider from '@react-native-community/slider';
import { useLiveCameraSkeleton } from '../hooks/useLiveCameraSkeleton';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { PoseStickmanSvg } from '../components/PoseStickmanSvg';
import { CalibrationSilhouette, CalibrationBadge } from '@/features/training/components/CalibrationGuide';
import { movesRepository } from '@/core/data/repositories/MovesRepository';
import { Move } from '@/features/moves/types/move.types';
import { BeatSegment } from '@/features/import/types/beatSegment.types';

const C = {
  bg: '#0A0E0E',
  surface: '#141B1B',
  surface2: '#1B2424',
  text: '#ECEFEE',
  dim: '#69767A',
  accent: '#1FE0C9',
  border: 'rgba(236,239,238,0.08)',
};

const OPACITY_RANGE: [number, number] = [0.15, 1];
const SPEED_RANGE: [number, number] = [0.5, 1.5];

type Phase = 'lobby' | 'active';

interface VideoPracticeScreenProps {
  route: { params: { moveId: string } };
  navigation: any;
}

export const VideoPracticeScreen: React.FC<VideoPracticeScreenProps> = ({ route, navigation }) => {
  const { moveId } = route.params;
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [move, setMove] = useState<Move | null>(null);
  const [phase, setPhase] = useState<Phase>('lobby');
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState(0);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [opacity, setOpacity] = useState(0.6);
  const [speed, setSpeed] = useState(1);
  const videoRef = useRef<any>(null);

  const { device, isActive, position, hasPermission, initialize, togglePosition, currentPose, frameProcessor } =
    useLiveCameraSkeleton();

  useEffect(() => {
    movesRepository.getById(moveId).then(m => setMove(m));
  }, [moveId]);

  // Migration fallback: pre-pivot imported moves have no `segments` — treat
  // the whole video as one implicit segment rather than crashing.
  const segments: BeatSegment[] = useMemo(() => {
    if (!move) return [];
    if (move.segments && move.segments.length > 0) return move.segments;
    return [{ startMs: 0, endMs: move.duration * 1000, label: 'Full Video' }];
  }, [move]);

  const currentSegment = segments[currentSegmentIndex];

  const seekToSegmentStart = useCallback((seg: BeatSegment | undefined) => {
    if (seg) videoRef.current?.seek(seg.startMs / 1000);
  }, []);

  useEffect(() => {
    if (phase === 'active') seekToSegmentStart(currentSegment);
  }, [currentSegmentIndex, phase, seekToSegmentStart]);

  const handleLoad = useCallback(() => {
    seekToSegmentStart(currentSegment);
  }, [currentSegment, seekToSegmentStart]);

  const handleProgress = useCallback((data: { currentTime: number }) => {
    const currentMs = data.currentTime * 1000;
    if (currentSegment && currentMs >= currentSegment.endMs) {
      videoRef.current?.seek(currentSegment.startMs / 1000);
    }
  }, [currentSegment]);

  const handleNextSegment = useCallback(() => {
    setCurrentSegmentIndex(i => Math.min(i + 1, segments.length - 1));
  }, [segments.length]);

  const handlePrevSegment = useCallback(() => {
    setCurrentSegmentIndex(i => Math.max(i - 1, 0));
  }, []);

  const handleStart = useCallback(() => {
    setCurrentSegmentIndex(selectedSegmentIndex);
    setPhase('active');
  }, [selectedSegmentIndex]);

  // ── Error / loading states ────────────────────────────────────────────────

  if (!hasPermission) {
    return (
      <View style={styles.errorScreen}>
        <Text style={styles.errorTitle}>Camera Access Needed</Text>
        <Text style={styles.errorSub}>Allow camera access to practice your moves</Text>
        <TouchableOpacity style={styles.accentBtn} onPress={initialize}>
          <Text style={styles.accentBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device || !move) {
    return <LoadingSpinner message="Loading…" />;
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Live camera (base layer, always running so calibration works pre-start) */}
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        frameProcessor={frameProcessor}
      />

      {phase === 'active' && (
        <>
          {/* Reference video, overlaid on top of the camera at adjustable opacity */}
          <View style={[StyleSheet.absoluteFill, { opacity }]}>
            <Video
              ref={videoRef}
              source={{ uri: move.importedVideoUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              rate={speed}
              paused={false}
              repeat={false}
              muted={false}
              onLoad={handleLoad}
              onProgress={handleProgress}
            />
          </View>

          {/* User live skeleton (teal), topmost layer */}
          {currentPose && (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <PoseStickmanSvg
                pose={currentPose}
                width={screenW}
                height={screenH}
                color="rgba(31,224,201,0.85)"
                mirrored={position === 'front'}
              />
            </View>
          )}
        </>
      )}

      {phase === 'lobby' && (
        <>
          <CalibrationSilhouette pose={currentPose} width={screenW} height={screenH} />

          <View style={styles.idleHeader}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={togglePosition}>
              <Text style={styles.iconBtnText}>{position === 'back' ? '🔄' : '🤳'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.idleContainer}>
            <View style={styles.startCard}>
              <CalibrationBadge pose={currentPose} />
              <Text style={styles.startCardTitle}>{move.name}</Text>
              <Text style={styles.startCardMeta}>
                {segments.length} {segments.length === 1 ? 'segment' : 'segments'} · Choose where to start
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.segmentPicker}
              >
                {segments.map((seg, i) => {
                  const selected = i === selectedSegmentIndex;
                  const durationSec = ((seg.endMs - seg.startMs) / 1000).toFixed(1);
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.segmentChip, selected && styles.segmentChipSelected]}
                      onPress={() => setSelectedSegmentIndex(i)}
                    >
                      <Text style={[styles.segmentChipLabel, selected && styles.segmentChipLabelSelected]} numberOfLines={1}>
                        {seg.label}
                      </Text>
                      <Text style={styles.segmentChipMeta}>{durationSec}s</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity style={styles.startBtn} onPress={handleStart} activeOpacity={0.85}>
                <Text style={styles.startBtnText}>▶  Start Practice</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {phase === 'active' && (
        <>
          {/* Top bar */}
          <View style={styles.topBar}>
            <View style={styles.moveTag}>
              <Text style={styles.eyebrow}>PRACTICE</Text>
              <Text style={styles.moveName} numberOfLines={1}>{move.name}</Text>
            </View>
            <View style={styles.topBarRight}>
              <TouchableOpacity style={styles.iconBtn} onPress={togglePosition}>
                <Text style={styles.iconBtnText}>{position === 'back' ? '🔄' : '🤳'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Bottom controls */}
          <View style={styles.bottomPanel}>
            <View style={styles.segmentNav}>
              <TouchableOpacity
                style={[styles.ctrlBtn, currentSegmentIndex === 0 && styles.ctrlBtnDisabled]}
                onPress={handlePrevSegment}
                disabled={currentSegmentIndex === 0}
              >
                <Text style={styles.ctrlBtnIcon}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.segmentLabel} numberOfLines={1}>
                {currentSegment?.label ?? ''} ({currentSegmentIndex + 1}/{segments.length})
              </Text>
              <TouchableOpacity
                style={[styles.ctrlBtn, currentSegmentIndex === segments.length - 1 && styles.ctrlBtnDisabled]}
                onPress={handleNextSegment}
                disabled={currentSegmentIndex === segments.length - 1}
              >
                <Text style={styles.ctrlBtnIcon}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>Opacity</Text>
              <Slider
                style={styles.slider}
                minimumValue={OPACITY_RANGE[0]}
                maximumValue={OPACITY_RANGE[1]}
                value={opacity}
                onValueChange={setOpacity}
                minimumTrackTintColor={C.accent}
                maximumTrackTintColor={C.surface2}
                thumbTintColor={C.accent}
              />
            </View>

            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>Speed</Text>
              <Slider
                style={styles.slider}
                minimumValue={SPEED_RANGE[0]}
                maximumValue={SPEED_RANGE[1]}
                value={speed}
                onValueChange={setSpeed}
                minimumTrackTintColor={C.accent}
                maximumTrackTintColor={C.surface2}
                thumbTintColor={C.accent}
              />
              <Text style={styles.sliderValue}>{speed.toFixed(2)}×</Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  errorScreen: {
    flex: 1, backgroundColor: C.bg,
    alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 12,
  },
  errorTitle: { color: C.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  errorSub: { color: C.dim, fontSize: 14, textAlign: 'center' },
  accentBtn: {
    marginTop: 12, backgroundColor: C.accent,
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 36,
  },
  accentBtnText: { color: '#06201D', fontSize: 16, fontWeight: '800' },

  // ── Lobby ──
  idleHeader: {
    position: 'absolute', top: 56, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10,
  },
  backBtnText: { color: C.text, fontSize: 14, fontWeight: '600' },
  idleContainer: {
    flex: 1, justifyContent: 'flex-end',
    paddingBottom: 40, paddingHorizontal: 16,
  },
  startCard: {
    backgroundColor: 'rgba(15,23,42,0.90)',
    borderRadius: 20, padding: 24,
    alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  startCardTitle: { color: C.text, fontSize: 20, fontWeight: '800', marginBottom: 8 },
  startCardMeta: {
    color: 'rgba(255,255,255,0.55)', fontSize: 13,
    textAlign: 'center', marginBottom: 16, lineHeight: 18,
  },
  segmentPicker: { gap: 8, paddingBottom: 20 },
  segmentChip: {
    minWidth: 84, backgroundColor: C.surface2,
    borderRadius: 12, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 8,
    alignItems: 'center',
  },
  segmentChipSelected: { borderColor: C.accent, backgroundColor: 'rgba(31,224,201,0.16)' },
  segmentChipLabel: { color: C.text, fontSize: 12, fontWeight: '700' },
  segmentChipLabelSelected: { color: C.accent },
  segmentChipMeta: { color: C.dim, fontSize: 10, marginTop: 2 },
  startBtn: {
    backgroundColor: C.accent, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 48,
  },
  startBtnText: { color: '#06201D', fontSize: 17, fontWeight: '700' },

  // ── Active session ──
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: 52, paddingHorizontal: 20, paddingBottom: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    zIndex: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  moveTag: { flex: 1, marginRight: 8 },
  eyebrow: {
    fontSize: 10, letterSpacing: 1.4, color: C.dim,
    fontWeight: '600', textTransform: 'uppercase', marginBottom: 2,
  },
  moveName: { fontSize: 18, fontWeight: '800', letterSpacing: -0.2, color: C.text },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnText: { fontSize: 14 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: C.text, fontSize: 14, fontWeight: '700' },

  bottomPanel: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20, paddingBottom: 44, paddingTop: 16,
    zIndex: 20, gap: 10,
    backgroundColor: 'rgba(10,14,14,0.82)',
  },
  segmentNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    marginBottom: 6,
  },
  ctrlBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.surface2,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  ctrlBtnDisabled: { opacity: 0.4 },
  ctrlBtnIcon: { color: C.text, fontSize: 20, lineHeight: 22 },
  segmentLabel: { color: C.text, fontSize: 13, fontWeight: '700', flexShrink: 1, maxWidth: 200, textAlign: 'center' },

  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sliderLabel: { color: C.dim, fontSize: 12, fontWeight: '700', width: 56 },
  slider: { flex: 1, height: 32 },
  sliderValue: { color: C.accent, fontSize: 12, fontWeight: '800', width: 44, textAlign: 'right' },
});
