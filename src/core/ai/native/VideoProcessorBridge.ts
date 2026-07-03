import { NativeEventEmitter, NativeModules } from 'react-native';
import { PoseFrameResult } from '../types/ml.types';

const { VideoProcessorModule } = NativeModules;

export interface ExtractionProgress {
  current: number;
  total: number;
  percent: number;
}

export interface ExtractionResult {
  poses: PoseFrameResult[];
  durationMs: number;
  totalFrames: number;
}

export interface ExtractionOptions {
  frameIntervalMs?: number;
  maxFrames?: number;
}

export interface AudioEnvelopeResult {
  envelope: number[];
  windowMs: number;
  durationMs: number;
}

export interface AudioEnvelopeOptions {
  windowMs?: number;
}

function isAvailable(): boolean {
  return VideoProcessorModule != null;
}

function pickVideo(): Promise<string> {
  if (!isAvailable()) {
    return Promise.reject(new Error('VideoProcessorModule is not available on this platform'));
  }
  return VideoProcessorModule.pickVideo();
}

function persistVideo(videoUri: string): Promise<string> {
  if (!isAvailable()) {
    return Promise.reject(new Error('VideoProcessorModule is not available on this platform'));
  }
  return VideoProcessorModule.persistVideo(videoUri);
}

function extractPosesFromVideo(
  videoUri: string,
  options: ExtractionOptions = {},
): Promise<ExtractionResult> {
  if (!isAvailable()) {
    return Promise.reject(new Error('VideoProcessorModule is not available on this platform'));
  }
  return VideoProcessorModule.extractPosesFromVideo(videoUri, options);
}

function extractAudioEnvelope(
  videoUri: string,
  options: AudioEnvelopeOptions = {},
): Promise<AudioEnvelopeResult> {
  if (!isAvailable()) {
    return Promise.reject(new Error('VideoProcessorModule is not available on this platform'));
  }
  return VideoProcessorModule.extractAudioEnvelope(videoUri, options);
}

function subscribeToProgress(
  listener: (progress: ExtractionProgress) => void,
): { remove: () => void } {
  if (!isAvailable()) return { remove: () => {} };
  const emitter = new NativeEventEmitter(VideoProcessorModule);
  const sub = emitter.addListener('onVideoExtractionProgress', listener);
  return { remove: () => sub.remove() };
}

export const videoProcessorBridge = {
  isAvailable,
  pickVideo,
  persistVideo,
  extractPosesFromVideo,
  extractAudioEnvelope,
  subscribeToProgress,
};
