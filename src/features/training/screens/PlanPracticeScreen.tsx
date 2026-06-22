import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Camera, useFrameProcessor } from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';
import { useCamera } from '@/features/practice/hooks/useCamera';
import { usePoseDetection } from '@/features/practice/hooks/usePoseDetection';
import { runNativePoseFrameProcessor } from '@/features/practice/utils/nativePoseFrameProcessor';
import { PoseStickmanSvg } from '@/features/practice/components/PoseStickmanSvg';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { useAppStore } from '@/core/state/store';
import { usePlanSession } from '../hooks/usePlanSession';
import { CountdownOverlay } from '../components/CountdownOverlay';
import { DrillBanner } from '../components/DrillBanner';
import { BreakOverlay } from '../components/BreakOverlay';

interface Props {
  route: { params: { dayNumber: number } };
  navigation: any;
}

export const PlanPracticeScreen: React.FC<Props> = ({ route, navigation }) => {
  const { dayNumber } = route.params;
  const { width: screenW, height: screenH } = useWindowDimensions();
  const activePlan = useAppStore(s => s.activePlan);
  const [overlayEnabled, setOverlayEnabled] = useState(true);

  const drills = useMemo(
    () => activePlan?.sessions.find(s => s.dayNumber === dayNumber)?.drills ?? [],
    [activePlan, dayNumber],
  );

  const session = usePlanSession(drills, dayNumber);

  const {
    device,
    isActive,
    position,
    hasPermission,
    initialize,
    stop: stopCamera,
    togglePosition,
  } = useCamera();

  const {
    isReady,
    currentPose,
    error,
    reportNativeFrameProcessorFailure,
  } = usePoseDetection();

  useEffect(() => {
    void initialize();
    return () => stopCamera();
  }, [initialize, stopCamera]);

  // Navigate to stats when session completes
  useEffect(() => {
    if (session.phase === 'complete' && session.sessionStatsId) {
      navigation.replace('SessionStats', { sessionStatsId: session.sessionStatsId });
    }
  }, [session.phase, session.sessionStatsId, navigation]);

  const handleNativeFailure = Worklets.createRunOnJS(() => {
    reportNativeFrameProcessorFailure();
  });

  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';
      if (!isReady) return;
      const ok = runNativePoseFrameProcessor(frame, { confidenceBias: 0 });
      if (!ok) handleNativeFailure();
    },
    [handleNativeFailure, isReady],
  );

  const handleBack = useCallback(() => {
    if (session.phase === 'idle') {
      navigation.goBack();
      return;
    }
    Alert.alert(
      'End Session?',
      'Your progress for completed drills will be saved.',
      [
        { text: 'Continue', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: () => {
            session.abort();
            navigation.goBack();
          },
        },
      ],
    );
  }, [session, navigation]);

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Camera permission required</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={initialize}>
          <Text style={styles.permissionBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device || !isReady) {
    if (error) {
      return (
        <View style={styles.container}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={initialize}>
            <Text style={styles.permissionBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return <LoadingSpinner message="Initializing camera…" />;
  }

  const showDrillIndex =
    session.phase === 'drill' || session.phase === 'break'
      ? session.phase === 'break'
        ? session.currentDrillIndex - 1
        : session.currentDrillIndex
      : 0;

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        frameProcessor={frameProcessor}
      />

      {/* Live stickman smart mirror */}
      {overlayEnabled && currentPose && (
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

      {/* Phase overlays */}
      {session.phase === 'countdown' && (
        <CountdownOverlay count={session.timeRemaining} />
      )}

      {session.phase === 'break' && (
        <BreakOverlay
          timeRemaining={session.timeRemaining}
          nextDrill={session.nextDrill}
        />
      )}

      {/* Header (always visible) */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={handleBack}>
          <Text style={styles.headerBtnText}>← Back</Text>
        </TouchableOpacity>

        {(session.phase === 'drill' || session.phase === 'break') && (
          <Text style={styles.drillCounter}>
            {showDrillIndex + 1} / {drills.length}
          </Text>
        )}

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerBtn} onPress={togglePosition}>
            <Text style={styles.headerBtnText}>{position === 'back' ? '🔄' : '🤳'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setOverlayEnabled(v => !v)}
          >
            <Text style={styles.headerBtnText}>{overlayEnabled ? '👁' : '👁‍🗨'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Drill banner (active drill phase) */}
      {session.phase === 'drill' && session.currentDrill && (
        <DrillBanner
          drill={session.currentDrill}
          timeRemaining={session.timeRemaining}
          tipIndex={session.currentTipIndex}
          totalDrills={drills.length}
          currentDrillIndex={session.currentDrillIndex}
        />
      )}

      {/* Start button (idle phase) */}
      {session.phase === 'idle' && drills.length > 0 && (
        <View style={styles.startContainer}>
          <View style={styles.startCard}>
            <Text style={styles.startCardTitle}>Day {dayNumber} Session</Text>
            <Text style={styles.startCardMeta}>
              {drills.length} drill{drills.length !== 1 ? 's' : ''} · Use the mirror to guide your movement
            </Text>
            <TouchableOpacity style={styles.startBtn} onPress={session.start} activeOpacity={0.85}>
              <Text style={styles.startBtnText}>▶  Start</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {drills.length === 0 && (
        <View style={styles.startContainer}>
          <Text style={styles.errorText}>No drills for this session</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
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
  headerBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  headerRight: { flexDirection: 'row', gap: 8 },
  drillCounter: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  startContainer: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  startCard: {
    backgroundColor: 'rgba(15,23,42,0.90)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    width: '100%',
  },
  startCardTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  startCardMeta: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  startBtn: {
    backgroundColor: '#9333EA',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  startBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  permissionBtn: {
    backgroundColor: '#9333EA',
    padding: 16,
    borderRadius: 12,
    margin: 20,
  },
  permissionBtnText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  errorText: { color: '#EF4444', fontSize: 18, textAlign: 'center', margin: 20 },
});
