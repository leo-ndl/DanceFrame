import { videoProcessorBridge, ExtractionOptions, ExtractionProgress } from '@/core/ai/native/VideoProcessorBridge';
import { PoseFrameResult } from '@/core/ai/types/ml.types';
import { poseSequenceExtractor, PoseExtractionResult } from './PoseSequenceExtractor';

export interface ImportedMoveData {
  videoUri: string;
  /** Key poses only (5–20 frames), distilled by PoseSequenceExtractor. */
  poses: PoseFrameResult[];
  durationMs: number;
  /** Total raw frames extracted by the native bridge. */
  frameCount: number;
  /** Number of key poses kept after distillation. */
  keyPoseCount: number;
  /** Smoothed per-frame motion profile — used by VideoProcessingScreen sparkline. */
  motionProfile: number[];
}

export interface ExtractOptions extends ExtractionOptions {
  bpm?: number;
}

class VideoPoseExtractor {
  async pickVideo(): Promise<string> {
    return videoProcessorBridge.pickVideo();
  }

  async extractFromVideo(
    videoUri: string,
    options: ExtractOptions = {},
    onProgress?: (progress: ExtractionProgress) => void,
  ): Promise<ImportedMoveData> {
    // If BPM is known, sample at quarter-beat resolution for musical alignment.
    const frameIntervalMs = options.bpm
      ? Math.round((60000 / options.bpm) / 4)
      : options.frameIntervalMs ?? 200;

    const extractionOptions: ExtractionOptions = {
      frameIntervalMs: Math.max(50, Math.min(500, frameIntervalMs)),
      maxFrames: options.maxFrames ?? 500,
    };

    const progressSub = onProgress
      ? videoProcessorBridge.subscribeToProgress(onProgress)
      : null;

    try {
      const raw = await videoProcessorBridge.extractPosesFromVideo(videoUri, extractionOptions);

      const extracted: PoseExtractionResult = poseSequenceExtractor.extract(
        raw.poses,
        raw.durationMs,
      );

      return {
        videoUri,
        poses: extracted.keyPoses,
        durationMs: raw.durationMs,
        frameCount: raw.totalFrames,
        keyPoseCount: extracted.keyPoses.length,
        motionProfile: extracted.motionProfile,
      };
    } finally {
      progressSub?.remove();
    }
  }

  isAvailable(): boolean {
    return videoProcessorBridge.isAvailable();
  }
}

export const videoPoseExtractor = new VideoPoseExtractor();
