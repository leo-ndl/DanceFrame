import { useCallback, useState } from 'react';
import { Alert, Linking, NativeModules, Platform } from 'react-native';
import { logger } from '@/shared/utils/logger';

const { DFScreenRecorder } = NativeModules;

export const useScreenRecorder = () => {
  const [isArmed, setIsArmed] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const isSupported = Platform.OS === 'ios' || Platform.OS === 'android';

  const toggleArmed = useCallback(() => {
    setIsArmed(v => !v);
  }, []);

  const start = useCallback(async () => {
    if (!isArmed || !isSupported || !DFScreenRecorder) return false;

    try {
      if (Platform.OS === 'ios') {
        const { available } = await DFScreenRecorder.isAvailable();
        if (!available) {
          logger.warn('Screen recording unavailable on this device');
          setIsArmed(false);
          return false;
        }
        await DFScreenRecorder.startRecording();
      } else {
        await DFScreenRecorder.requestPermissionAndStart();
      }
      setIsRecording(true);
      return true;
    } catch (err: any) {
      logger.error('Failed to start screen recording', err);
      if (err?.code === 'E_PERMISSION_DENIED') {
        if (Platform.OS === 'ios') {
          Alert.alert(
            'Screen Recording Permission Needed',
            'Allow screen recording to save your practice session video.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ],
          );
        } else {
          Alert.alert(
            'Screen Recording Cancelled',
            'You declined the screen recording prompt, so this session will not be recorded.',
          );
        }
      }
      setIsRecording(false);
      setIsArmed(false);
      return false;
    }
  }, [isArmed, isSupported]);

  const stop = useCallback(async () => {
    if (!DFScreenRecorder) return;
    try {
      const result = await DFScreenRecorder.stopRecording();
      if (result?.saved === false && result?.error) {
        logger.warn('Recording finished but was not saved', result.error);
      }
    } catch (err) {
      logger.error('Failed to stop screen recording', err);
    } finally {
      setIsRecording(false);
    }
  }, []);

  return { isSupported, isArmed, isRecording, toggleArmed, start, stop };
};
