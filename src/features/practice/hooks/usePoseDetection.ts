import { useState, useEffect, useCallback, useRef } from 'react';
import { EmitterSubscription } from 'react-native';
import { Pose } from '../types/pose.types';
import { logger } from '@/shared/utils/logger';
import { useAppStore } from '@/core/state/store';
import {
  initializePoseInference,
  isPoseInferenceAvailable,
  startPoseInference,
  stopPoseInference,
  subscribeToPoseErrors,
  subscribeToPoseEvents,
  subscribeToPoseState,
} from '@/core/ai/native';
import { AI_CONSTANTS } from '@/config/constants/ai';
import {
  isNativePoseFrameProcessorAvailable,
  resetNativePoseFrameProcessorFailure,
} from '../utils/nativePoseFrameProcessor';

type PoseRuntimeMode = 'native';

export const usePoseDetection = () => {
  const [isReady, setIsReady] = useState(false);
  const [currentPose, setCurrentPose] = useState<Pose | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runtimeMode] = useState<PoseRuntimeMode>('native');

  const selectedModel = useAppStore(state => state.selectedModel);
  const nativeFailureReportedRef = useRef(false);
  const hasReceivedNativePoseRef = useRef(false);
  const nativeStartupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nativePoseSubscriptionRef = useRef<EmitterSubscription | null>(null);
  const nativeStateSubscriptionRef = useRef<EmitterSubscription | null>(null);
  const nativeErrorSubscriptionRef = useRef<EmitterSubscription | null>(null);

  const clearNativeSubscriptions = useCallback(() => {
    nativePoseSubscriptionRef.current?.remove();
    nativeStateSubscriptionRef.current?.remove();
    nativeErrorSubscriptionRef.current?.remove();

    nativePoseSubscriptionRef.current = null;
    nativeStateSubscriptionRef.current = null;
    nativeErrorSubscriptionRef.current = null;
    hasReceivedNativePoseRef.current = false;

    if (nativeStartupTimerRef.current) {
      clearTimeout(nativeStartupTimerRef.current);
      nativeStartupTimerRef.current = null;
    }
  }, []);

  const initializeNativeRuntime = useCallback(async (): Promise<boolean> => {
    if (!isPoseInferenceAvailable()) {
      setError('Native pose module is unavailable in this build.');
      return false;
    }
    if (!isNativePoseFrameProcessorAvailable()) {
      setError('Native frame processor plugin is unavailable in this build.');
      return false;
    }

    const didInitialize = await initializePoseInference({
      modelType: selectedModel,
      minKeypointConfidence: AI_CONSTANTS.MIN_CONFIDENCE,
      targetFps: 30,
    });

    if (!didInitialize) {
      setError('Failed to initialize native pose runtime.');
      return false;
    }

    hasReceivedNativePoseRef.current = false;
    nativePoseSubscriptionRef.current = subscribeToPoseEvents((pose) => {
      hasReceivedNativePoseRef.current = true;
      setCurrentPose(pose);
    });
    nativeStateSubscriptionRef.current = subscribeToPoseState((state) => {
      logger.log('Native pose runtime state:', state);
    });
    nativeErrorSubscriptionRef.current = subscribeToPoseErrors((nativeError) => {
      logger.error('Native pose runtime error:', nativeError);
      setError(nativeError.message);
    });

    await startPoseInference();
    setIsReady(true);
    setError(null);
    nativeFailureReportedRef.current = false;
    logger.log('Pose detection ready (native runtime)');

    nativeStartupTimerRef.current = setTimeout(() => {
      if (hasReceivedNativePoseRef.current) {
        return;
      }

      logger.warn('Native runtime started but no pose events were emitted yet.');
      setError('Native runtime started but no pose events were emitted yet.');
    }, 5000);

    return true;
  }, [selectedModel]);

  const initialize = useCallback(async () => {
    try {
      logger.log('Initializing native pose detection runtime...');
      setIsReady(false);
      setError(null);
      setCurrentPose(null);
      nativeFailureReportedRef.current = false;
      resetNativePoseFrameProcessorFailure();
      clearNativeSubscriptions();
      await stopPoseInference();

      const didInitializeNative = await initializeNativeRuntime();
      if (!didInitializeNative) {
        setIsReady(false);
      }
    } catch (err) {
      logger.error('Failed to initialize native pose detection:', err);
      setError('Failed to initialize native pose runtime');
      setIsReady(false);
    }
  }, [clearNativeSubscriptions, initializeNativeRuntime]);

  const cleanup = useCallback(async () => {
    try {
      clearNativeSubscriptions();
      await stopPoseInference();
      resetNativePoseFrameProcessorFailure();
      nativeFailureReportedRef.current = false;
      setIsReady(false);
      setCurrentPose(null);
    } catch (err) {
      logger.error('Cleanup error:', err);
    }
  }, [clearNativeSubscriptions]);

  const reportNativeFrameProcessorFailure = useCallback(() => {
    if (nativeFailureReportedRef.current) {
      return;
    }

    nativeFailureReportedRef.current = true;
    setError('Native frame processor failed. Retry initialization.');
    setIsReady(false);

    void (async () => {
      try {
        clearNativeSubscriptions();
        await stopPoseInference();
      } catch (stopError) {
        logger.error('Failed to stop native runtime after frame processor failure:', stopError);
      }
    })();
  }, [clearNativeSubscriptions]);

  useEffect(() => {
    void initialize();
    return () => {
      void cleanup();
    };
  }, [cleanup, initialize]);

  return {
    isReady,
    currentPose,
    isProcessing: false,
    error,
    runtimeMode,
    reportNativeFrameProcessorFailure,
  };
};
