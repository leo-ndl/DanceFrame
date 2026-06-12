import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Camera, useFrameProcessor } from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';
import { useCamera } from '../hooks/useCamera';
import { usePoseDetection } from '../hooks/usePoseDetection';
import { usePracticeSession } from '../hooks/usePracticeSession';
import { theme } from '@/config/theme';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { runNativePoseFrameProcessor } from '../utils/nativePoseFrameProcessor';
import { ScoreDisplay } from '../components/ScoreDisplay';
import { MicroFeedback } from '../components/MicroFeedback';
import { NextPosePreview } from '../components/NextPosePreview';
import { PoseStickmanSvg } from '../components/PoseStickmanSvg';
import { movesRepository } from '@/core/data/repositories/MovesRepository';
import { Move } from '@/features/moves/types/move.types';

interface PracticeScreenProps {
  route: { params: { moveId: string } };
  navigation: any;
}

export const PracticeScreen: React.FC<PracticeScreenProps> = ({ route, navigation }) => {
  const { moveId } = route.params;
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [move, setMove] = useState<Move | null>(null);
  const [isOverlayEnabled, setIsOverlayEnabled] = useState(true);

  type SizeKey = 'S' | 'M' | 'L';
  const SIZE_PX: Record<SizeKey, number> = { S: 90, M: 120, L: 155 };
  const [sizeKey, setSizeKey] = useState<SizeKey>('M');

  const { device, isActive, position, hasPermission, initialize, stop: stopCamera, togglePosition } = useCamera();
  const {
    isReady,
    currentPose,
    error,
    runtimeMode,
    reportNativeFrameProcessorFailure,
  } = usePoseDetection();

  const session = usePracticeSession(move);
  const { nextReferencePose, beatIntervalMs } = session;

  // Load move on mount.
  useEffect(() => {
    movesRepository.getById(moveId).then(m => setMove(m));
  }, [moveId]);

  useEffect(() => {
    void initialize();
    return () => stopCamera();
  }, [initialize, stopCamera]);

  // Feed every new pose into the session coaching loop.
  useEffect(() => {
    if (currentPose && session.isActive) {
      session.onNewPose(currentPose);
    }
  }, [currentPose]);

  const handleStart = useCallback(() => session.start(), [session]);

  const handleStop = useCallback(() => {
    const id = session.stop();
    if (id) {
      navigation.navigate('Results', { sessionId: id });
    } else {
      navigation.goBack();
    }
  }, [session, navigation]);

  const handleNativeFrameProcessorFailure = Worklets.createRunOnJS(() => {
    reportNativeFrameProcessorFailure();
  });

  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';
      if (!isReady) return;
      const ok = runNativePoseFrameProcessor(frame, { confidenceBias: 0 });
      if (!ok) handleNativeFrameProcessorFailure();
    },
    [handleNativeFrameProcessorFailure, isReady],
  );

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Camera permission required</Text>
        <TouchableOpacity style={styles.button} onPress={initialize}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device || !isReady) {
    if (error) {
      return (
        <View style={styles.container}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.button} onPress={initialize}>
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return <LoadingSpinner message="Initializing camera and AI…" />;
  }

  const hasReference = (move?.referencePoses.length ?? 0) > 0;

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        frameProcessor={frameProcessor}
      />

      {/* Live pose stickman — full-screen, tracks user's actual body position */}
      {isOverlayEnabled && currentPose && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <PoseStickmanSvg
            pose={currentPose}
            width={screenW}
            height={screenH}
            color="rgba(60, 206, 100, 0.85)"
            mirrored={position === 'front'}
          />
        </View>
      )}

      {/* Coaching overlay */}
      <View style={styles.overlay} pointerEvents="box-none">
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.moveName} numberOfLines={1}>
            {move?.name ?? 'Practice'}
          </Text>
          <TouchableOpacity style={styles.headerBtn} onPress={togglePosition}>
            <Text style={styles.backText}>{position === 'back' ? '🔄' : '🤳'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setIsOverlayEnabled(v => !v)}
          >
            <Text style={styles.backText}>{isOverlayEnabled ? '👁' : '👁‍🗨'}</Text>
          </TouchableOpacity>
        </View>

        {/* Live score (only when session active) */}
        {session.isActive && (
          <View style={styles.scorePosition}>
            <ScoreDisplay score={session.currentScore} combo={session.combo} />
          </View>
        )}

        {/* Micro-feedback toast */}
        <MicroFeedback message={session.feedback} />

        {/* Beat Cue: next pose preview */}
        {session.isActive && (
          <NextPosePreview
            pose={nextReferencePose}
            beatIntervalMs={beatIntervalMs}
            mirrored={position === 'front'}
            stickmanSize={SIZE_PX[sizeKey]}
            style={styles.nextPosePreview}
          />
        )}

        {/* Bottom controls */}
        <View style={styles.bottomBar}>
          {session.isActive ? (
            <TouchableOpacity style={styles.stopBtn} onPress={handleStop}>
              <Text style={styles.stopBtnText}>⏹  Finish</Text>
            </TouchableOpacity>
          ) : (
            <>
              <View style={styles.sizePicker}>
                <Text style={styles.sizePickerLabel}>Preview size</Text>
                <View style={styles.sizePickerBtns}>
                  {(['S', 'M', 'L'] as const).map(key => (
                    <TouchableOpacity
                      key={key}
                      style={[styles.sizeBtn, sizeKey === key && styles.sizeBtnActive]}
                      onPress={() => setSizeKey(key)}
                    >
                      <Text style={[styles.sizeBtnText, sizeKey === key && styles.sizeBtnTextActive]}>
                        {key}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <TouchableOpacity style={styles.startBtn} onPress={handleStart}>
                <Text style={styles.startBtnText}>
                  {hasReference ? '▶  Start Practice' : '▶  Free Practice'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* Rep counter */}
          {session.isActive && session.repsCompleted > 0 && (
            <Text style={styles.repsText}>{session.repsCompleted} rep{session.repsCompleted !== 1 ? 's' : ''}</Text>
          )}
        </View>

        {/* Runtime badge */}
        <View style={styles.runtimeBadge}>
          <Text style={styles.runtimeText}>{runtimeMode.toUpperCase()}</Text>
        </View>

        {error && (
          <View style={styles.warningBadge}>
            <Text style={styles.warningText}>{error}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1 },
  header: {
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  backText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  moveName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  scorePosition: {
    position: 'absolute',
    top: 130,
    right: 16,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    alignItems: 'center',
    gap: 8,
  },
  startBtn: {
    backgroundColor: theme.colors.primary[600],
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  startBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  stopBtn: {
    backgroundColor: 'rgba(239,68,68,0.85)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  stopBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  repsText: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  nextPosePreview: {
    position: 'absolute',
    bottom: 100,
    left: 16,
  },
  sizePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sizePickerLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '500',
  },
  sizePickerBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  sizeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  sizeBtnActive: {
    backgroundColor: 'rgba(100,180,255,0.35)',
    borderWidth: 1.5,
    borderColor: 'rgba(100,180,255,0.8)',
  },
  sizeBtnText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '700',
  },
  sizeBtnTextActive: {
    color: '#fff',
  },
  runtimeBadge: {
    position: 'absolute',
    bottom: 10,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  runtimeText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  warningBadge: {
    position: 'absolute',
    bottom: 110,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(194,65,12,0.85)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  warningText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  errorText: { color: theme.colors.error, fontSize: 18, textAlign: 'center', margin: 20 },
  button: {
    backgroundColor: theme.colors.primary[600],
    padding: 16,
    borderRadius: 12,
    margin: 20,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
