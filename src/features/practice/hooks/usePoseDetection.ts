import { useState, useEffect, useCallback, useRef } from 'react';
import { modelManager } from '@/core/ai/models/ModelManager';
import { FrameProcessor } from '@/core/ai/processors/FrameProcessor';
import { PoseProcessor } from '@/core/ai/processors/PoseProcessor';
import { Pose } from '../types/pose.types';
import { logger } from '@/shared/utils/logger';
import { useAppStore } from '@/core/state/store';

export const usePoseDetection = () => {
  const [isReady, setIsReady] = useState(false);
  const [currentPose, setCurrentPose] = useState<Pose | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const selectedModel = useAppStore(state => state.selectedModel);
  const processingRef = useRef(false);

  useEffect(() => {
    initialize();
    return () => {
      cleanup();
    };
  }, [selectedModel]);

  const initialize = async () => {
    try {
      logger.log('Initializing pose detection...');
      await modelManager.initialize(selectedModel);
      setIsReady(true);
      setError(null);
      logger.log('Pose detection ready');
    } catch (err) {
      logger.error('Failed to initialize pose detection:', err);
      setError('Failed to initialize AI model');
      setIsReady(false);
    }
  };

  const cleanup = async () => {
    try {
      await modelManager.dispose();
      setIsReady(false);
    } catch (err) {
      logger.error('Cleanup error:', err);
    }
  };

  const detectPose = useCallback(async (
    frameData: Uint8Array,
    width: number,
    height: number
  ): Promise<Pose | null> => {
    if (!isReady || processingRef.current) {
      return null;
    }

    processingRef.current = true;
    setIsProcessing(true);

    try {
      // Get model
      const model = modelManager.getModel(selectedModel);
      
      // Preprocess frame
      const inputSize = selectedModel === 'lightning' ? 192 : 256;
      const input = FrameProcessor.preprocessFrame(
        frameData,
        width,
        height,
        inputSize
      );

      // Run inference
      const output = await model.run(input);

      // Parse to Pose
      const pose = PoseProcessor.processPoseOutput(output);
      
      setCurrentPose(pose);
      return pose;
    } catch (err) {
      logger.error('Pose detection error:', err);
      return null;
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [isReady, selectedModel]);

  return {
    isReady,
    currentPose,
    isProcessing,
    error,
    detectPose,
  };
};