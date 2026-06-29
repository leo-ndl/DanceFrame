import { videoProcessorBridge, ExtractionOptions, ExtractionProgress } from '@/core/ai/native/VideoProcessorBridge';
import { PoseFrameResult } from '@/core/ai/types/ml.types';
import { MotionRepresentation } from '../types/motion.types';
import { motionExtractionPipeline } from './MotionExtractionPipeline';

export interface ImportedMoveData {
  videoUri: string;
  motionRepresentation: MotionRepresentation;
  durationMs: number;
  /** Total raw frames extracted by the native bridge. */
  frameCount: number;
  /**
   * Flat array of teaching poses from all segments — populated for backward
   * compatibility with PracticeScreen which reads Move.referencePoses.
   */
  poses: PoseFrameResult[];
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
    // Default to ~30fps; honour explicit override or BPM-based alignment.
    const frameIntervalMs = options.bpm
      ? Math.round((60000 / options.bpm) / 4)
      : options.frameIntervalMs ?? 33;

    const extractionOptions: ExtractionOptions = {
      frameIntervalMs: Math.max(33, Math.min(500, frameIntervalMs)),
      maxFrames: options.maxFrames ?? 1200,
    };

    const progressSub = onProgress
      ? videoProcessorBridge.subscribeToProgress(onProgress)
      : null;

    try {
      const raw = await videoProcessorBridge.extractPosesFromVideo(videoUri, extractionOptions);

      const motionRepresentation = motionExtractionPipeline.extract(
        raw.poses,
        raw.durationMs,
      );

      // Teaching poses in chronological order (flat across all segments)
      const poses: PoseFrameResult[] = motionRepresentation.segments.flatMap(seg =>
        seg.teachingPoses.map(f => ({
          keypoints: f.keypoints,
          timestamp: f.timestamp,
          confidence: f.confidence,
        })),
      );

      return {
        videoUri,
        motionRepresentation,
        durationMs: raw.durationMs,
        frameCount: raw.totalFrames,
        poses,
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
