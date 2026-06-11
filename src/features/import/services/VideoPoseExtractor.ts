import { videoProcessorBridge, ExtractionOptions, ExtractionProgress } from '@/core/ai/native/VideoProcessorBridge';
import { PoseFrameResult } from '@/core/ai/types/ml.types';

export interface ImportedMoveData {
  videoUri: string;
  poses: PoseFrameResult[];
  durationMs: number;
  frameCount: number;
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
      const result = await videoProcessorBridge.extractPosesFromVideo(videoUri, extractionOptions);
      return {
        videoUri,
        poses: result.poses,
        durationMs: result.durationMs,
        frameCount: result.totalFrames,
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
