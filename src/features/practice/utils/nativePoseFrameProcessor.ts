import { Frame, VisionCameraProxy } from 'react-native-vision-camera';

type PoseFrameProcessorPlugin = {
  call: (frame: Frame, options?: Record<string, unknown>) => unknown;
};

let posePlugin: PoseFrameProcessorPlugin | undefined;
let hasNativePoseProcessorFailed = false;

try {
  posePlugin = VisionCameraProxy.initFrameProcessorPlugin('poseFrameProcessor', {}) as
    | PoseFrameProcessorPlugin
    | undefined;
} catch (error) {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message ?? 'Unknown plugin error')
      : 'Unknown plugin error';
  console.warn('[DanceFrame WARN] Native pose frame processor unavailable:', message);
}

export const isNativePoseFrameProcessorAvailable = (): boolean => posePlugin != null;

export const resetNativePoseFrameProcessorFailure = (): void => {
  hasNativePoseProcessorFailed = false;
};

export const runNativePoseFrameProcessor = (
  frame: Frame,
  options: Record<string, unknown> = {}
): boolean => {
  'worklet';
  if (posePlugin == null || hasNativePoseProcessorFailed) {
    return false;
  }

  try {
    posePlugin.call(frame, options);
    return true;
  } catch (error) {
    hasNativePoseProcessorFailed = true;
    console.warn('[DanceFrame WARN] Native pose frame processor threw an error and was disabled.', error);
    return false;
  }
};
