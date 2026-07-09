import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useComboTracker } from '@/features/practice/hooks/useComboTracker';
import { useRollingAnalysis } from '@/features/practice/hooks/useRollingAnalysis';
import { PoseFrameResult } from '@/core/ai/types/ml.types';
import { PoseStreamFrame } from '@/features/moves/types/motion.types';
import { movesRepository } from '@/core/data/repositories/MovesRepository';
import { clamp01 } from '@/shared/utils/poseMetrics';
import { haptics } from '@/shared/utils/haptics';
import { voiceCoach } from '@/shared/utils/voiceCoach';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { colors } from '@/config/theme/colors';
import { useAppStore } from '@/core/state/store';
import { useScreenRecorder } from '@/features/practice/hooks/useScreenRecorder';
import { usePlanSession } from '../hooks/usePlanSession';
import { useDrillScoring, ScoreMode } from '../hooks/useDrillScoring';
import { useReferenceFreeCoachAnalysis } from '../hooks/useReferenceFreeCoachAnalysis';
import { useTrainingCoach } from '../hooks/useTrainingCoach';
import { UnifiedCoachingEvent } from '../types/coaching.types';
import { CompletedDrillResult, TrainingDrill } from '../types/training.types';
import { CalibrationBadge, CalibrationSilhouette } from '../components/CalibrationGuide';
import { CountdownOverlay } from '../components/CountdownOverlay';
import { BreakOverlay } from '../components/BreakOverlay';
import { SessionProgressBar } from '../components/SessionProgressBar';
import { HitCounter } from '../components/HitCounter';
import { BeatVisualizer } from '../components/BeatVisualizer';
import { DrillCompleteOverlay } from '../components/DrillCompleteOverlay';

const EMPTY_STREAM: PoseStreamFrame[] = [];

// Spoken via voiceCoach, not rendered — kept emoji-free so TTS doesn't try
// to read symbols aloud.
const MILESTONE_MESSAGES: Record<number, string> = {
  5: 'On fire! Keep it up!',
  10: 'Combo times ten! Incredible!',
  20: 'Combo times twenty! Unstoppable!',
  50: 'Combo times fifty! Legendary!',
};

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

  // Refs break the circular dependency between usePlanSession (needs a
  // result-getter at drill-completion time) and useDrillScoring/useComboTracker
  // (which need usePlanSession's phase/currentDrill as inputs). See plan Phase A.
  const drillScoringRef = useRef<{ scoreMode: ScoreMode; currentScore: number }>({
    scoreMode: 'heuristic',
    currentScore: 0,
  });
  const comboRef = useRef<{ bestComboThisSession: number }>({ bestComboThisSession: 0 });
  // Running average of the reference-free motion summary for the current
  // drill attempt (FR-10 session summary). Populated by an effect below,
  // once referenceFreeAnalysis is available — same ref-first pattern as
  // drillScoringRef/comboRef above.
  const skillAccumRef = useRef({ rhythm: 0, balance: 0, smoothness: 0, amplitude: 0, count: 0 });

  const getDrillResult = useCallback(
    (drill: TrainingDrill): Omit<CompletedDrillResult, 'drillId' | 'moveId'> => {
      const { scoreMode, currentScore } = drillScoringRef.current;
      const avgScore = scoreMode === 'compared' ? currentScore : null;
      const isNewBest =
        scoreMode === 'compared' && avgScore !== null && !!drill.moveId
          ? movesRepository.updateProgressSync(drill.moveId, avgScore)
          : false;
      const { count, ...totals } = skillAccumRef.current;
      const skillAverages =
        count > 0
          ? {
              rhythm: totals.rhythm / count,
              balance: totals.balance / count,
              smoothness: totals.smoothness / count,
              amplitude: totals.amplitude / count,
            }
          : undefined;
      return {
        scoreMode,
        avgScore,
        bestCombo: comboRef.current.bestComboThisSession,
        isNewBest,
        skillAverages,
      };
    },
    [],
  );

  const session = usePlanSession(drills, dayNumber, getDrillResult);

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

  const recorder = useScreenRecorder();
  const isRecordingRef = useRef(false);
  useEffect(() => {
    isRecordingRef.current = recorder.isRecording;
  }, [recorder.isRecording]);

  const isDrillActive = session.phase === 'drill' && !session.isPaused;
  const combo = useComboTracker(isDrillActive);
  const drillScoring = useDrillScoring(
    session.currentDrill,
    currentPose,
    isDrillActive,
    session.isPaused,
    session.drillAttemptId,
    combo.registerScore,
  );

  // A manual restart re-runs the same drill without `phase` ever leaving
  // 'drill', so useComboTracker's isActive-toggle reset won't fire on its
  // own — force it here off the same attempt signal useDrillScoring uses.
  useEffect(() => {
    combo.reset();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.drillAttemptId]);

  useEffect(() => {
    drillScoringRef.current = { scoreMode: drillScoring.scoreMode, currentScore: drillScoring.currentScore };
  }, [drillScoring.scoreMode, drillScoring.currentScore]);

  useEffect(() => {
    comboRef.current = { bestComboThisSession: combo.bestComboThisSession };
  }, [combo.bestComboThisSession]);

  // Comparison-based coaching (repeatedMistake/syncLoss/etc, via
  // useRollingAnalysis below) only runs with a real reference stream to
  // compare against. useReferenceFreeCoachAnalysis (below) covers every
  // drill regardless, including heuristic-mode ones with no reference.
  const referenceStream = useMemo(
    () =>
      drillScoring.scoreMode === 'compared'
        ? drillScoring.move?.motionRepresentation?.stream ?? EMPTY_STREAM
        : EMPTY_STREAM,
    [drillScoring.scoreMode, drillScoring.move],
  );
  const drillProgress = session.currentDrill
    ? clamp01(1 - session.timeRemaining / Math.max(session.currentDrill.durationSeconds, 1))
    : 0;
  const rollingAnalysis = useRollingAnalysis(
    referenceStream,
    drillProgress,
    currentPose,
    isDrillActive && drillScoring.scoreMode === 'compared',
    4000,
  );

  // Reference-free counterpart to rollingAnalysis — runs for every drill
  // (heuristic or compared) since it needs only the dancer's own pose
  // buffer, not a linked reference-move stream.
  const referenceFreeAnalysis = useReferenceFreeCoachAnalysis(currentPose, isDrillActive, 4000);

  const poseBufferRef = useRef<PoseFrameResult[]>([]);
  useEffect(() => {
    if (currentPose && isDrillActive) {
      poseBufferRef.current = [...poseBufferRef.current.slice(-19), currentPose];
    }
  }, [currentPose, isDrillActive]);

  // Voice coaching — replaces the old FeedbackToast. Speaks milestones and
  // AI/rule-based coaching tips instead of rendering them, since the dancer
  // can't read the screen mid-movement.
  useEffect(() => {
    if (!combo.lastMilestone) return;
    haptics.comboMilestone();
    voiceCoach.speakMilestone(MILESTONE_MESSAGES[combo.lastMilestone] ?? `Combo ${combo.lastMilestone}!`);
  }, [combo.lastMilestone]);

  // Edge-triggered exercise-completion event (FR-2/FR-7 bypass-throttle
  // exception), fed into useTrainingCoach alongside the two analysis streams.
  const [completionEvent, setCompletionEvent] = useState<UnifiedCoachingEvent | null>(null);
  const prevPhaseForCompletionRef = useRef(session.phase);
  useEffect(() => {
    const prevPhase = prevPhaseForCompletionRef.current;
    prevPhaseForCompletionRef.current = session.phase;
    if (prevPhase !== 'drillComplete' && session.phase === 'drillComplete') {
      setCompletionEvent({ source: 'session', kind: 'exerciseCompletion' });
    } else if (session.phase !== 'drillComplete') {
      setCompletionEvent(null);
    }
  }, [session.phase]);

  useTrainingCoach(
    rollingAnalysis,
    referenceFreeAnalysis,
    completionEvent,
    session.currentDrill,
    isDrillActive,
    session.drillAttemptId,
  );

  // Populates skillAccumRef (declared near drillScoringRef/comboRef above),
  // reset on every new drill attempt.
  useEffect(() => {
    skillAccumRef.current = { rhythm: 0, balance: 0, smoothness: 0, amplitude: 0, count: 0 };
  }, [session.drillAttemptId]);
  useEffect(() => {
    if (!isDrillActive || referenceFreeAnalysis.summary.windowSize === 0) return;
    const s = referenceFreeAnalysis.summary;
    skillAccumRef.current.rhythm += s.rhythm;
    skillAccumRef.current.balance += s.balance;
    skillAccumRef.current.smoothness += s.smoothness;
    skillAccumRef.current.amplitude += s.amplitude;
    skillAccumRef.current.count += 1;
  }, [referenceFreeAnalysis.summary, isDrillActive]);

  // Haptic on drill completion / personal best
  useEffect(() => {
    if (!session.lastDrillResult) return;
    if (session.lastDrillResult.isNewBest) haptics.personalBest();
    else haptics.drillComplete();
  }, [session.lastDrillResult]);

  useEffect(() => {
    void voiceCoach.init();
    void initialize();
    return () => {
      stopCamera();
      voiceCoach.stop();
    };
  }, [initialize, stopCamera]);

  useEffect(() => {
    if (session.phase === 'complete' && session.sessionStatsId) {
      navigation.replace('SessionStats', { sessionStatsId: session.sessionStatsId });
    }
  }, [session.phase, session.sessionStatsId, navigation]);

  // Recording spans one full session: armed at 'idle', started the moment the
  // countdown begins, stopped on natural completion. A manual restartDrill()
  // never revisits 'countdown' (see usePlanSession.ts), so edge-triggering off
  // the idle→countdown transition (rather than a bare phase === 'countdown'
  // check) ensures a drill restart doesn't stop/restart the recording.
  const prevPhaseRef = useRef(session.phase);
  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = session.phase;

    if (prevPhase === 'idle' && session.phase === 'countdown') {
      void recorder.start();
    }
    if (session.phase === 'complete' && isRecordingRef.current) {
      void recorder.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.phase]);

  // Unmount safety net — covers exit paths that bypass handleBack/handleQuit
  // (e.g. hardware back button) so a recording is never left dangling.
  useEffect(() => {
    return () => {
      if (isRecordingRef.current) void recorder.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            if (isRecordingRef.current) void recorder.stop();
            voiceCoach.stop();
            session.abort();
            navigation.goBack();
          },
        },
      ],
    );
  }, [session, navigation, recorder]);

  const handleQuit = useCallback(() => {
    if (isRecordingRef.current) void recorder.stop();
    voiceCoach.stop();
    session.abort();
    navigation.goBack();
  }, [session, navigation, recorder]);

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

  const { phase, currentDrill, nextDrill, timeRemaining, currentDrillIndex } = session;
  const isSessionActive = phase !== 'idle';
  const drillDisplayIndex = phase === 'break' ? currentDrillIndex - 1 : currentDrillIndex;

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
            mirrored={false}
          />
        </View>
      )}

      {phase === 'idle' && (
        <CalibrationSilhouette pose={currentPose} width={screenW} height={screenH} />
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
            {recorder.isRecording && (
              <View style={styles.recordingBadge}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingBadgeText}>REC</Text>
              </View>
            )}
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

      {/* ── Drill-complete celebration ── */}
      {phase === 'drillComplete' && (
        <DrillCompleteOverlay drillName={currentDrill?.name ?? ''} result={session.lastDrillResult} />
      )}

      {/* ── Drill phase UI ── */}
      {phase === 'drill' && currentDrill && (
        <>
          <HitCounter count={combo.hitCount} combo={combo.combo} justHit={combo.justHit} />
          <BeatVisualizer
            isActive={!session.isPaused}
            justHit={combo.justHit}
            syncConfidence={drillScoring.scoreMode === 'compared' ? rollingAnalysis.syncConfidence : undefined}
          />
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
            <View style={styles.idleHeaderRight}>
              {recorder.isSupported && (
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={recorder.toggleArmed}
                  disabled={recorder.isRecording}
                >
                  <Text style={styles.iconBtnText}>{recorder.isArmed ? '⏺️' : '⚪️'}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.iconBtn} onPress={togglePosition}>
                <Text style={styles.iconBtnText}>{position === 'back' ? '🔄' : '🤳'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.startCard}>
            <CalibrationBadge pose={currentPose} />
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
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  recordingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FF4D4D',
  },
  recordingBadgeText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
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
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  idleHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
