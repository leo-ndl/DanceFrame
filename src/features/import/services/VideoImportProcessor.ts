import { videoProcessorBridge } from '@/core/ai/native/VideoProcessorBridge';
import { BeatSegment } from '../types/beatSegment.types';
import { segmentByBeats, estimateBpm } from './BeatSegmenter';

export interface ImportedVideoData {
  /** Permanent storage URI (post persistVideo). */
  videoUri: string;
  durationMs: number;
  segments: BeatSegment[];
  bpm?: number;
}

class VideoImportProcessor {
  async pickVideo(): Promise<string> {
    return videoProcessorBridge.pickVideo();
  }

  async processVideo(pickedUri: string): Promise<ImportedVideoData> {
    const permanentUri = await videoProcessorBridge.persistVideo(pickedUri);
    const { envelope, windowMs, durationMs } = await videoProcessorBridge.extractAudioEnvelope(permanentUri);
    const segments = segmentByBeats(envelope, windowMs, durationMs);

    return {
      videoUri: permanentUri,
      durationMs,
      segments,
      bpm: estimateBpm(segments),
    };
  }

  isAvailable(): boolean {
    return videoProcessorBridge.isAvailable();
  }
}

export const videoImportProcessor = new VideoImportProcessor();
