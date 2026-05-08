import { useState, useCallback } from 'react';
import { useCameraDevice, useCameraFormat } from 'react-native-vision-camera';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { logger } from '@/shared/utils/logger';

export const useCamera = () => {
  const device = useCameraDevice('back');
  const format = useCameraFormat(device, [
    { fps: 30 },
    { videoResolution: { width: 640, height: 480 } }
  ])
  
  const { cameraPermission, requestCameraPermission } = usePermissions();
  const [isActive, setIsActive] = useState(false);

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


  return {
    format,
    device,
    isActive,
    hasPermission: cameraPermission === 'granted',
    initialize,
    stop,
  };
};