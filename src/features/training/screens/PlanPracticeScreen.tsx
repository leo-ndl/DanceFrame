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
import Svg, { Path, Rect } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import { useCamera } from '@/features/practice/hooks/useCamera';
import { usePoseDetection } from '@/features/practice/hooks/usePoseDetection';
import { runNativePoseFrameProcessor } from '@/features/practice/utils/nativePoseFrameProcessor';
import { PoseStickmanSvg } from '@/features/practice/components/PoseStickmanSvg';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { colors } from '@/config/theme/colors';
import { useAppStore } from '@/core/state/store';
import { usePlanSession } from '../hooks/usePlanSession';
import { CountdownOverlay } from '../components/CountdownOverlay';
import { BreakOverlay } from '../components/BreakOverlay';
import { SessionProgressBar } from '../components/SessionProgressBar';
import { HitCounter } from '../components/HitCounter';
import { TargetPoseCard } from '../components/TargetPoseCard';
import { BeatVisualizer } from '../components/BeatVisualizer';
import { FeedbackToast } from '../components/FeedbackToast';

interface Props {
  route: { params: { dayNumber: number } };
  navigation: any;
}

const formatTime = (secs: number): string => {
  const m = Math.floor(Math.max(0, secs) / 60)
    .toString()
    .padStart(2, '0');
  const s = (Math.max(0, secs) % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

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

  const { isReady, currentPose, error, reportNativeFrameProcessorFailure } = usePoseDetection();

  useEffect(() => {
    void initialize();
    return () => stopCamera();
  }, [initialize, stopCamera]);

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

  const handleQuit = useCallback(() => {
    session.abort();
    navigation.goBack();
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

  const { phase, currentDrill, nextDrill, timeRemaining, currentDrillIndex, currentTipIndex } = session;
  const isSessionActive = phase !== 'idle';
  const drillDisplayIndex = phase === 'break' ? currentDrillIndex - 1 : currentDrillIndex;
  const currentTip = currentDrill?.coachingTips[currentTipIndex % (currentDrill.coachingTips.length || 1)] ?? '';

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        frameProcessor={frameProcessor}
      />

      {overlayEnabled && currentPose && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <PoseStickmanSvg
            pose={currentPose}
            width={screenW}
            height={screenH}
            color={colors.primary[500]}
            mirrored={position === 'front'}
          />
        </View>
      )}

      {/* ── Top bar (visible when session is active) ── */}
      {isSessionActive && (
        <View style={styles.topbar} pointerEvents="box-none">
          <View style={styles.moveTag}>
            <Text style={styles.moveEyebrow}>
              Move {drillDisplayIndex + 1} of {drills.length}
            </Text>
            <Text style={styles.moveName} numberOfLines={1}>
              {currentDrill?.name ?? ''}
            </Text>
          </View>
          <View style={styles.topbarRight}>
            <TouchableOpacity style={styles.iconBtn} onPress={togglePosition}>
              <Text style={styles.iconBtnText}>{position === 'back' ? '🔄' : '🤳'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setOverlayEnabled(v => !v)}
            >
              <Text style={styles.iconBtnText}>{overlayEnabled ? '👁' : '👁‍🗨'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={handleBack}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Session progress bar ── */}
      {isSessionActive && drills.length > 0 && (
        <SessionProgressBar
          totalDrills={drills.length}
          currentDrillIndex={drillDisplayIndex}
          phase={phase}
          drillDurationSeconds={currentDrill?.durationSeconds ?? 30}
          drillId={currentDrill?.id ?? ''}
        />
      )}

      {/* ── Countdown overlay ── */}
      {phase === 'countdown' && <CountdownOverlay count={timeRemaining} />}

      {/* ── Break overlay ── */}
      {phase === 'break' && (
        <BreakOverlay timeRemaining={timeRemaining} nextDrill={nextDrill} />
      )}

      {/* ── Drill phase UI ── */}
      {phase === 'drill' && currentDrill && (
        <>
          <HitCounter count={session.hitCount} />
          <TargetPoseCard />
          <BeatVisualizer isActive={!session.isPaused} />
          <FeedbackToast tip={currentTip} tipIndex={currentTipIndex} />

          {/* Bottom panel */}
          <LinearGradient
            colors={['rgba(10,14,14,0)', 'rgba(10,14,14,0.88)', '#0A0E0E']}
            style={styles.bottomPanel}
          >
            <View style={styles.timerRow}>
              <Text style={styles.timerNum}>{formatTime(timeRemaining)}</Text>
              <Text style={styles.timerUnit}>/ {formatTime(currentDrill.durationSeconds)}</Text>
            </View>

            <Text style={styles.nextUp}>
              {nextDrill
                ? <>Next: <Text style={styles.nextUpBold}>{nextDrill.name}</Text> · {formatTime(nextDrill.durationSeconds)}</>
                : 'Last drill'}
            </Text>

            <View style={styles.controlsRow}>
              {/* Quit */}
              <TouchableOpacity style={styles.ctrlBtn} onPress={handleQuit} activeOpacity={0.75}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M18 6 L6 18 M6 6 L18 18"
                    stroke={colors.text}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </Svg>
              </TouchableOpacity>

              {/* Pause / Resume */}
              <TouchableOpacity
                style={styles.pauseBtn}
                onPress={session.isPaused ? session.resume : session.pause}
                activeOpacity={0.85}
              >
                {session.isPaused ? (
                  // Play icon
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="#06201D">
                    <Path d="M6 4 L20 12 L6 20 Z" fill="#06201D" />
                  </Svg>
                ) : (
                  // Pause icon
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="#06201D">
                    <Rect x={6} y={5} width={4} height={14} fill="#06201D" />
                    <Rect x={14} y={5} width={4} height={14} fill="#06201D" />
                  </Svg>
                )}
              </TouchableOpacity>

              {/* Restart drill */}
              <TouchableOpacity style={styles.ctrlBtn} onPress={session.restartDrill} activeOpacity={0.75}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M3 12 A9 9 0 1 1 12 21"
                    stroke={colors.text}
                    strokeWidth={2}
                    strokeLinecap="round"
                    fill="none"
                  />
                  <Path
                    d="M3 12 L3 6 M3 12 L9 12"
                    stroke={colors.text}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </Svg>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </>
      )}

      {/* ── Idle start card ── */}
      {phase === 'idle' && (
        <View style={styles.idleContainer}>
          {/* Minimal header for idle state */}
          <View style={styles.idleHeader}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.startCard}>
            <Text style={styles.startCardTitle}>Day {dayNumber} Session</Text>
            <Text style={styles.startCardMeta}>
              {drills.length} drill{drills.length !== 1 ? 's' : ''} · Use the mirror to guide your movement
            </Text>
            {drills.length > 0 && (
              <TouchableOpacity style={styles.startBtn} onPress={session.start} activeOpacity={0.85}>
                <Text style={styles.startBtnText}>▶  Start</Text>
              </TouchableOpacity>
            )}
            {drills.length === 0 && (
              <Text style={styles.errorText}>No drills for this session</Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // ── Top bar ──
  topbar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
    backgroundColor: 'rgba(0,0,0,0)',
  },
  moveTag: {
    flexDirection: 'column',
    gap: 2,
    flex: 1,
  },
  moveEyebrow: {
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    fontWeight: '600',
  },
  moveName: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.01,
    color: colors.text,
  },
  topbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: {
    fontSize: 14,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Bottom panel ──
  bottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 34,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  timerNum: {
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: -1,
    color: colors.text,
    lineHeight: 56,
    fontVariant: ['tabular-nums'],
  },
  timerUnit: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
    paddingBottom: 8,
  },
  nextUp: {
    textAlign: 'center',
    fontSize: 11.5,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: 18,
  },
  nextUpBold: {
    color: colors.text,
    fontWeight: '700',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  ctrlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary[500],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },

  // ── Idle state ──
  idleHeader: {
    position: 'absolute',
    top: 56,
    left: 16,
  },
  backBtn: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  backBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  idleContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  startCard: {
    backgroundColor: 'rgba(15,23,42,0.90)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  startCardTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  startCardMeta: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  startBtn: {
    backgroundColor: colors.primary[600],
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  startBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },

  // ── Error / permission ──
  permissionBtn: {
    backgroundColor: colors.primary[600],
    padding: 16,
    borderRadius: 12,
    margin: 20,
  },
  permissionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorText: {
    color: colors.error,
    fontSize: 18,
    textAlign: 'center',
    margin: 20,
  },
});
