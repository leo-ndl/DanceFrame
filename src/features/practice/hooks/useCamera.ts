import { useState, useCallback, useEffect } from 'react';
import { NativeModules } from 'react-native';
import { useCameraDevice, CameraPosition } from 'react-native-vision-camera';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { logger } from '@/shared/utils/logger';

const { DFKeepAwake } = NativeModules;

export const useCamera = () => {
  const [position, setPosition] = useState<CameraPosition>('back');
  const device = useCameraDevice(position);
  const { cameraPermission, requestCameraPermission } = usePermissions();
  const [isActive, setIsActive] = useState(false);

  const togglePosition = useCallback(() => {
    setPosition(p => (p === 'back' ? 'front' : 'back'));
  }, []);

  const initialize = useCallback(async () => {
    if (cameraPermission !== 'granted') {
      const permission = await requestCameraPermission();
      if (permission !== 'granted') {
        logger.error('Camera permission denied');
        return false;
      }
    }
    
    setIsActive(true);
    return true;
  }, [cameraPermission, requestCameraPermission]);

  const stop = useCallback(() => {
    setIsActive(false);
  }, []);

  useEffect(() => {
    if (isActive) {
      DFKeepAwake?.activate();
      return () => { DFKeepAwake?.deactivate(); };
    }
  }, [isActive]);

  return {
    device,
    isActive,
    position,
    hasPermission: cameraPermission === 'granted',
    initialize,
    stop,
    togglePosition,
  };
};
