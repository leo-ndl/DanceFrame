import { useEffect } from 'react';
import { useFrameProcessor } from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';
import { useCamera } from './useCamera';
import { usePoseDetection } from './usePoseDetection';
import { runNativePoseFrameProcessor } from '../utils/nativePoseFrameProcessor';

// Shared live-camera + pose-estimation setup, extracted from PracticeScreen so
// it can be reused by any screen that needs the live user skeleton overlay
// (e.g. VideoPracticeScreen) without duplicating camera/frame-processor wiring.
export function useLiveCameraSkeleton() {
  const { device, isActive, position, hasPermission, initialize, stop: stopCamera, togglePosition } = useCamera();
  const { isReady, currentPose, error, runtimeMode, reportNativeFrameProcessorFailure } = usePoseDetection();

  useEffect(() => {
    void initialize();
    return () => stopCamera();
  }, [initialize, stopCamera]);

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

  return {
    device,
    isActive,
    position,
    hasPermission,
    initialize,
    togglePosition,
    currentPose,
    isReady,
    error,
    runtimeMode,
    frameProcessor,
  };
}
