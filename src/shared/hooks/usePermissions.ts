import { useEffect, useState } from 'react';
import { Camera, CameraPermissionStatus } from 'react-native-vision-camera';
import { Alert, Linking } from 'react-native';

export const usePermissions = () => {
  const [cameraPermission, setCameraPermission] = useState<CameraPermissionStatus>('not-determined');
  const [microphonePermission, setMicrophonePermission] = useState<CameraPermissionStatus>('not-determined');

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    const camera = await Camera.getCameraPermissionStatus();
    const microphone = await Camera.getMicrophonePermissionStatus();
    
    setCameraPermission(camera);
    setMicrophonePermission(microphone);
  };

  const requestCameraPermission = async () => {
    const permission = await Camera.requestCameraPermission();
    setCameraPermission(permission);
    
    if (permission === 'denied') {
      Alert.alert(
        'Camera Permission Required',
        'Please enable camera access in settings to use SensAI',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
    
    return permission;
  };

  const requestMicrophonePermission = async () => {
    const permission = await Camera.requestMicrophonePermission();
    setMicrophonePermission(permission);
    return permission;
  };

  return {
    cameraPermission,
    microphonePermission,
    requestCameraPermission,
    requestMicrophonePermission,
    hasAllPermissions: cameraPermission === 'granted' && microphonePermission === 'granted',
  };
};