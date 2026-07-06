import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Camera } from 'react-native-vision-camera';
import { useLiveCameraSkeleton } from '../hooks/useLiveCameraSkeleton';
import { usePracticeSession } from '../hooks/usePracticeSession';
import { useMetrics, MetricsSnapshot } from '../hooks/useMetrics';
import { useSessionStages } from '../hooks/useSessionStages';
import { useCheckpoint } from '../hooks/useCheckpoint';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { PoseStickmanSvg } from '../components/PoseStickmanSvg';
import { MascotPanel } from '../components/MascotPanel';
import { MetricsBar } from '../components/MetricsBar';
import { CoachingPanel } from '../components/CoachingPanel';
import { CheckpointOverlay } from '../components/CheckpointOverlay';
import { ImprovementFlash } from '../components/ImprovementFlash';
import { movesRepository } from '@/core/data/repositories/MovesRepository';
import { Move } from '@/features/moves/types/move.types';
import { PoseFrameResult } from '@/core/ai/types/ml.types';
import { PlaybackSpeed } from '../hooks/useMascotPlayback';
import { PoseStreamFrame } from '@/features/moves/types/motion.types';
import { useRollingAnalysis } from '../hooks/useRollingAnalysis';
import { coachingEngine } from '../services/CoachingEngine';
import { SyncIndicator } from '../components/SyncIndicator';

// Stable empty fallback — prevents `?? []` from creating a new array each render.
const EMPTY_STREAM: PoseStreamFrame[] = [];

const C = {
  bg: '#0A0E0E',
  surface: '#141B1B',
  surface2: '#1B2424',
  text: '#ECEFEE',
  dim: '#69767A',
  accent: '#1FE0C9',
  accentSoft: 'rgba(31,224,201,0.16)',
  border: 'rgba(236,239,238,0.08)',
  warn: '#FF6B4A',
};

const SPEED_CYCLE: PlaybackSpeed[] = [0.25, 0.5, 1, 1.5];
const POSE_BUFFER_SIZE = 20;

interface PracticeScreenProps {
  route: { params: { moveId: string } };
  navigation: any;
}

export const PracticeScreen: React.FC<PracticeScreenProps> = ({ route, navigation }) => {
  const { moveId } = route.params;
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [move, setMove] = useState<Move | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Manual speed override (stage provides a default, user can cycle through)
  const [speedOverride, setSpeedOverride] = useState<PlaybackSpeed | null>(null);

  // Mascot progress (0-1) for the movement progress bar
  const [mascotProgress, setMascotProgress] = useState(0);

  // Rolling pose buffer for live metrics
  const poseBufferRef = useRef<PoseFrameResult[]>([]);

  // Improvement flash
  const [improvementLabel, setImprovementLabel] = useState<string | null>(null);
  const prevMetricsRef = useRef<MetricsSnapshot | null>(null);
  const improvementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { device, isActive, position, hasPermission, initialize, togglePosition, currentPose, isReady, error, runtimeMode, frameProcessor } = useLiveCameraSkeleton();
  const session = usePracticeSession(move);

  const stageConfig = useSessionStages(elapsedSeconds, session.isActive);
  const activeSpeed = speedOverride ?? stageConfig.mascotSpeed;

  const metrics = useMetrics(session.lastComparison, poseBufferRef.current);
  const checkpointData = useCheckpoint(elapsedSeconds, metrics, session.isActive);

  // Must be before any early returns — hooks cannot be called conditionally.
  const stream = useMemo(
    () => move?.motionRepresentation?.stream ?? EMPTY_STREAM,
    [move],
  );

  const rollingAnalysis = useRollingAnalysis(
    stream,
    mascotProgress,
    currentPose,
    session.isActive,
    2500,
  );

  const [aiCoachMessage, setAiCoachMessage] = useState<{ text: string; id: number } | null>(null);
  const aiCoachIdRef = useRef(0);
  const aiCallInFlightRef = useRef(false);

  useEffect(() => {
    movesRepository.getById(moveId).then(m => setMove(m));
  }, [moveId]);

  // Append live poses to rolling buffer
  useEffect(() => {
    if (currentPose && session.isActive) {
      session.onNewPose(currentPose);
      poseBufferRef.current = [
        ...poseBufferRef.current.slice(-(POSE_BUFFER_SIZE - 1)),
        currentPose,
      ];
    }
  }, [currentPose]);

  // Timer
  useEffect(() => {
    if (!session.isActive || session.isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (!session.isActive) setElapsedSeconds(0);
      return;
    }
    timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [session.isActive, session.isPaused]);

  // Clear stale AI message when session stops
  useEffect(() => {
    if (!session.isActive) setAiCoachMessage(null);
  }, [session.isActive]);

  // Fire AI coaching when a meaningful event is detected
  useEffect(() => {
    if (!rollingAnalysis.event || !session.isActive || aiCallInFlightRef.current) return;
    aiCallInFlightRef.current = true;
    coachingEngine
      .getSuggestion(rollingAnalysis, metrics, move?.name ?? 'this move')
      .then(msg => { if (msg) setAiCoachMessage({ text: msg, id: ++aiCoachIdRef.current }); })
      .finally(() => { aiCallInFlightRef.current = false; });
  }, [rollingAnalysis.event]);

  // Detect metric improvements
  useEffect(() => {
    const prev = prevMetricsRef.current;
    if (!prev) { prevMetricsRef.current = metrics; return; }
    const METRIC_LABELS: Record<keyof MetricsSnapshot, string> = {
      smoothness: 'Smoothness ↑',
      balance: 'Balance ↑',
      stability: 'Stability ↑',
      symmetry: 'Symmetry ↑',
      flow: 'Flow ↑',
      rangeOfMotion: 'Range of Motion ↑',
      control: 'Control ↑',
    };
    for (const k of Object.keys(metrics) as (keyof MetricsSnapshot)[]) {
      if ((metrics[k] - (prev[k] ?? 0)) >= 0.1) {
        setImprovementLabel(METRIC_LABELS[k]);
        if (improvementTimerRef.current) clearTimeout(improvementTimerRef.current);
        improvementTimerRef.current = setTimeout(() => setImprovementLabel(null), 1600);
        break;
      }
    }
    prevMetricsRef.current = metrics;
  }, [metrics]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const handleStart = useCallback(() => session.start(), [session]);

  const handleFinish = useCallback(() => {
    const id = session.stop();
    if (id) navigation.navigate('Results', { sessionId: id });
    else navigation.goBack();
  }, [session, navigation]);

  const handlePauseResume = useCallback(() => {
    if (session.isPaused) session.resume();
    else session.pause();
  }, [session]);

  const handleRestartMovement = useCallback(() => {
    // Reset reference frame index to 0 by restarting with same move
    if (session.isActive) {
      session.pause();
      session.resume();
    }
  }, [session]);

  const handleCycleSpeed = useCallback(() => {
    const currentIdx = SPEED_CYCLE.indexOf(activeSpeed);
    const nextIdx = (currentIdx + 1) % SPEED_CYCLE.length;
    setSpeedOverride(SPEED_CYCLE[nextIdx] ?? 1);
  }, [activeSpeed]);

  const handleMascotProgress = useCallback((p: number) => {
    setMascotProgress(p);
    session.onMascotProgress(p);
  }, [session]);

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

  if (!device || !isReady) {
    if (error) {
      return (
        <View style={styles.errorScreen}>
          <Text style={styles.errorTitle}>Unable to Start</Text>
          <Text style={styles.errorSub}>{error}</Text>
          <TouchableOpacity style={styles.accentBtn} onPress={initialize}>
            <Text style={styles.accentBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return <LoadingSpinner message="Initializing camera and AI…" />;
  }

  const hasReference = (move?.referencePoses.length ?? 0) > 0;
  const xp = session.repsCompleted * Math.round((metrics.control ?? 0) * 100);

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Camera */}
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        frameProcessor={frameProcessor}
      />

      {/* Mascot (lime-green, left side, always visible) */}
      <MascotPanel
        stream={stream}
        fallbackPoses={move?.referencePoses ?? []}
        speed={activeSpeed}
        screenWidth={screenW}
        screenHeight={screenH}
        onProgress={handleMascotProgress}
      />

      {/* User live skeleton (teal) */}
      {currentPose && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <PoseStickmanSvg
            pose={currentPose}
            width={screenW}
            height={screenH}
            color="rgba(31,224,201,0.85)"
            mirrored={false}
          />
        </View>
      )}

      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.moveTag}>
          <Text style={styles.eyebrow}>PRACTICE</Text>
          <Text style={styles.moveName} numberOfLines={1}>{move?.name ?? '…'}</Text>
        </View>
        {session.isActive && (
          <View style={[styles.stagePill, stageConfig.stage === 'challenge' && styles.stagePillChallenge]}>
            <Text style={styles.stagePillText}>{stageConfig.label}</Text>
          </View>
        )}
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Movement progress bar (2px under top bar) */}
      {session.isActive && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${mascotProgress * 100}%` }]} />
        </View>
      )}

      {/* Combo + XP row */}
      {session.isActive && session.combo > 1 && (
        <View style={styles.comboRow}>
          <Text style={styles.comboText}>🔥 ×{session.combo}</Text>
          {xp > 0 && <Text style={styles.xpText}>✨ {xp} XP</Text>}
        </View>
      )}

      {/* Metrics strip (right side, active only) */}
      {session.isActive && <MetricsBar metrics={metrics} />}

      {/* Improvement flash (top-center) */}
      <ImprovementFlash label={session.isActive ? improvementLabel : null} />

      {/* Sync confidence indicator */}
      {session.isActive && (
        <SyncIndicator confidence={rollingAnalysis.syncConfidence} />
      )}

      {/* Coaching panel (persistent, above bottom controls) */}
      {session.isActive && (
        <CoachingPanel
          metrics={metrics}
          hintLevel={stageConfig.hintLevel}
          externalMessage={aiCoachMessage ?? (session.feedback ? { text: session.feedback, id: 0 } : null)}
        />
      )}

      {/* Checkpoint overlay (full-screen, auto-dismiss) */}
      <CheckpointOverlay data={session.isActive ? checkpointData : null} />

      {/* Bottom panel */}
      <View style={styles.bottomPanel}>
        {session.isActive ? (
          <>
            <Text style={styles.timerNum}>{formatTime(elapsedSeconds)}</Text>
            <View style={styles.controlsRow}>
              <TouchableOpacity style={styles.ctrlBtn} onPress={handlePauseResume}>
                <Text style={styles.ctrlBtnIcon}>{session.isPaused ? '▶' : '▮▮'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ctrlBtn} onPress={handleRestartMovement}>
                <Text style={styles.ctrlBtnIcon}>↩</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.finishBtn} onPress={handleFinish}>
                <Text style={styles.finishBtnIcon}>⏹</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ctrlBtn} onPress={togglePosition}>
                <Text style={styles.ctrlBtnIcon}>{position === 'front' ? '🤳' : '🔄'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.speedBtn} onPress={handleCycleSpeed}>
                <Text style={styles.speedText}>{activeSpeed}×</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <TouchableOpacity style={styles.startBtn} onPress={handleStart}>
            <Text style={styles.startBtnText}>
              {hasReference ? '▶  Start Practice' : '▶  Free Practice'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Runtime badge */}
      <View style={styles.runtimeBadge}>
        <Text style={styles.runtimeText}>{runtimeMode.toUpperCase()}</Text>
      </View>

      {error && !session.isActive && (
        <View style={styles.errorBadge}>
          <Text style={styles.errorBadgeText}>{error}</Text>
        </View>
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

  stagePill: {
    backgroundColor: C.accentSoft,
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4,
    marginRight: 8,
  },
  stagePillChallenge: {
    backgroundColor: 'rgba(255,107,74,0.18)',
  },
  stagePillText: {
    fontSize: 9, fontWeight: '800', letterSpacing: 1.2,
    color: C.accent, textTransform: 'uppercase',
  },

  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: C.text, fontSize: 14, fontWeight: '700' },

  progressTrack: {
    position: 'absolute', top: 102, left: 0, right: 0,
    height: 2, backgroundColor: 'rgba(255,255,255,0.08)', zIndex: 21,
  },
  progressFill: {
    height: '100%', backgroundColor: C.accent,
  },

  comboRow: {
    position: 'absolute', top: 112, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 14, zIndex: 20,
  },
  comboText: { fontSize: 14, fontWeight: '800', color: C.accent },
  xpText: { fontSize: 13, fontWeight: '700', color: '#F0E68C' },

  bottomPanel: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20, paddingBottom: 44, paddingTop: 20,
    zIndex: 20, alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(10,14,14,0.82)',
  },
  timerNum: {
    fontSize: 48, fontWeight: '900', letterSpacing: -1,
    color: C.text, lineHeight: 52,
  },
  controlsRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 12,
  },
  ctrlBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.surface2,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  ctrlBtnIcon: { color: C.text, fontSize: 15 },
  finishBtn: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38, shadowRadius: 14, elevation: 8,
  },
  finishBtnIcon: { fontSize: 20, color: '#06201D' },
  speedBtn: {
    height: 44, borderRadius: 22,
    paddingHorizontal: 12,
    backgroundColor: C.surface2,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  speedText: { color: C.accent, fontSize: 13, fontWeight: '800' },
  startBtn: {
    width: '100%', backgroundColor: C.accent,
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 6,
  },
  startBtnText: { color: '#06201D', fontSize: 17, fontWeight: '800' },

  runtimeBadge: {
    position: 'absolute', bottom: 10, right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, zIndex: 30,
  },
  runtimeText: { color: C.dim, fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },

  errorBadge: {
    position: 'absolute', bottom: 170, left: 16, right: 16,
    zIndex: 25, backgroundColor: 'rgba(194,65,12,0.85)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  errorBadgeText: { color: C.text, fontSize: 12, fontWeight: '600' },
});
