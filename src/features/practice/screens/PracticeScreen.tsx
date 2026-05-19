import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Camera, useFrameProcessor } from 'react-native-vision-camera';
import { useCamera } from '../hooks/useCamera';
import { usePoseDetection } from '../hooks/usePoseDetection';
import { theme } from '@/config/theme';
import { LoadingSpinner } from '@/shared/components/feedback/LoadingSpinner';
import { runNativePoseFrameProcessor } from '../utils/nativePoseFrameProcessor';
import { Worklets } from 'react-native-worklets-core';

interface PracticeScreenProps {
  route: {
    params: {
      moveId: string;
    };
  };
  navigation: any;
}

export const PracticeScreen: React.FC<PracticeScreenProps> = ({ navigation }) => {
  const { device, isActive, hasPermission, initialize, stop } = useCamera();
  const {
    isReady,
    currentPose,
    error,
    runtimeMode,
    reportNativeFrameProcessorFailure,
  } = usePoseDetection();

  useEffect(() => {
    void initialize();
    return () => {
      stop();
    };
  }, [initialize, stop]);

  const handleNativeFrameProcessorFailure = Worklets.createRunOnJS(() => {
    reportNativeFrameProcessorFailure();
  });

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    if (!isReady) return;

    const didProcessInNativeRuntime = runNativePoseFrameProcessor(frame, { confidenceBias: 0 });
    if (!didProcessInNativeRuntime) {
      handleNativeFrameProcessorFailure();
    }
  }, [handleNativeFrameProcessorFailure, isReady]);

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
    if (error) {
      return (
        <View style={styles.container}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.button} onPress={initialize}>
            <Text style={styles.buttonText}>Retry Initialization</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return <LoadingSpinner message="Initializing camera and AI runtime..." />;
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

        <View style={styles.runtimeBadge}>
          <Text style={styles.runtimeText}>Runtime: {runtimeMode.toUpperCase()}</Text>
        </View>

        {error && (
          <View style={styles.warningBadge}>
            <Text style={styles.warningText}>{error}</Text>
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
  runtimeBadge: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  runtimeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  warningBadge: {
    position: 'absolute',
    bottom: 70,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(194, 65, 12, 0.85)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  warningText: {
    color: '#fff',
    fontSize: 12,
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
