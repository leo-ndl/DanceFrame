import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Camera, useFrameProcessor } from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';
import { useCamera } from '../hooks/useCamera';
import { usePoseDetection } from '../hooks/usePoseDetection';
import { usePracticeSession } from '../hooks/usePracticeSession';
import { theme } from '@/config/theme';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { runNativePoseFrameProcessor } from '../utils/nativePoseFrameProcessor';
import { NativePoseOverlay } from '../components/NativePoseOverlay';
import { ScoreDisplay } from '../components/ScoreDisplay';
import { MicroFeedback } from '../components/MicroFeedback';
import { movesRepository } from '@/core/data/repositories/MovesRepository';
import { Move } from '@/features/moves/types/move.types';

interface PracticeScreenProps {
  route: { params: { moveId: string } };
  navigation: any;
}

export const PracticeScreen: React.FC<PracticeScreenProps> = ({ route, navigation }) => {
  const { moveId } = route.params;
  const [move, setMove] = useState<Move | null>(null);
  const [isOverlayEnabled, setIsOverlayEnabled] = useState(true);

  const { device, isActive, hasPermission, initialize, stop: stopCamera } = useCamera();
  const {
    isReady,
    currentPose,
    error,
    runtimeMode,
    reportNativeFrameProcessorFailure,
  } = usePoseDetection();

  const session = usePracticeSession(move);

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

      {/* Live stickman + reference ghost */}
      <NativePoseOverlay
        enabled={isOverlayEnabled}
        mirrored={device.position === 'front'}
      />

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

        {/* Bottom controls */}
        <View style={styles.bottomBar}>
          {session.isActive ? (
            <TouchableOpacity style={styles.stopBtn} onPress={handleStop}>
              <Text style={styles.stopBtnText}>⏹  Finish</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.startBtn} onPress={handleStart}>
              <Text style={styles.startBtnText}>
                {hasReference ? '▶  Start Practice' : '▶  Free Practice'}
              </Text>
            </TouchableOpacity>
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
