import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Camera, useFrameProcessor, runAsync } from 'react-native-vision-camera';
import { useCamera } from '../hooks/useCamera';
import { usePoseDetection } from '../hooks/usePoseDetection';
import { theme } from '@/config/theme';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { logger } from '@/shared/utils/logger';
import { extractFrame } from '../utils/helper';

interface PracticeScreenProps {
  route: {
    params: {
      moveId: string;
    };
  };
  navigation: any;
}

export const PracticeScreen: React.FC<PracticeScreenProps> = ({ route, navigation }) => {
  const { moveId } = route.params;
  const { device, isActive, hasPermission, initialize, stop } = useCamera();
  const { isReady, currentPose, detectPose } = usePoseDetection();
  const [frameCount, setFrameCount] = useState(0);

  useEffect(() => {
    startPractice();
    return () => {
      stop();
    };
  }, []);

  const startPractice = async () => {
    await initialize();
  };

  const handleFrame = async (frame: any) => {
    'worklet';
    // Process every 3rd frame
    setFrameCount((prevCount) => prevCount + 1);
    if (frameCount % 3 !== 0) return;
    if(isReady){
        const frameData = extractFrame(frame);
        const pose = await detectPose(frameData, frame.width, frame.height);
       if(pose) {
          logger.info('Detected pose:', pose);
        }
    }
  };

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    runAsync(frame, ()=>{
      'worklet';
      handleFrame(frame);
    });
    
  }, [frameCount]);

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Camera permission required</Text>
        <TouchableOpacity style={styles.button} onPress={initialize}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device || !isReady) {
    return <LoadingSpinner message="Initializing camera and AI..." />;
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        frameProcessor={frameProcessor}
      />
      
      {/* Overlay UI */}
      <View style={styles.overlay}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
        </View>

        {currentPose && (
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreText}>
              Confidence: {Math.round(currentPose.confidence * 100)}%
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  backButton: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  scoreContainer: {
    position: 'absolute',
    top: 120,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
    borderRadius: 12,
  },
  scoreText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 18,
    textAlign: 'center',
    margin: 20,
  },
  button: {
    backgroundColor: theme.colors.primary[600],
    padding: 16,
    borderRadius: 12,
    margin: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});