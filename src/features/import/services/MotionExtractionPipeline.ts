import { PoseFrameResult } from '@/core/ai/types/ml.types';
import { MotionRepresentation, MovementSegment } from '../types/motion.types';
import { normalizePoseStream } from './PoseNormalizer';
import { smoothPoseStream } from './TemporalSmoother';
import { buildPoseStream } from './PoseStreamBuilder';
import { segmentStream } from './MovementSegmenter';
import { computeMetadata } from './MetadataComputer';
import { generateTeachingPoses } from './TeachingPoseGenerator';

class MotionExtractionPipeline {
  extract(raw: PoseFrameResult[], durationMs: number): MotionRepresentation {
    const totalRawFrames = raw.length;

    if (raw.length === 0) {
      return {
        stream: [],
        segments: [],
        durationMs,
        totalRawFrames: 0,
        compressionRatio: 1,
      };
    }

    // Step 1: body normalization — remove camera-position/distance variation (FR-4)
    const normalized = normalizePoseStream(raw);

    // Step 2: temporal smoothing — reduce pose-estimation jitter (FR-5)
    const smoothed = smoothPoseStream(normalized);

    // Step 3: build full-fidelity stream — all frames kept (FR-1, FR-2, FR-3)
    const stream = buildPoseStream(smoothed, durationMs);

    // Step 3: movement segmentation (FR-6)
    const rawSegments = segmentStream(stream);

    // Steps 4 + 5: metadata + teaching poses per segment (FR-7, FR-8)
    const segments: MovementSegment[] = rawSegments.map(rawSeg => {
      const segFrames = stream.slice(rawSeg.poseRange[0], rawSeg.poseRange[1] + 1);
      const metadata = computeMetadata(segFrames);
      const teachingPoses = generateTeachingPoses(
        segFrames,
        rawSeg.durationMs,
        rawSeg.complexityScore,
      );
      return { ...rawSeg, metadata, teachingPoses };
    });

    const compressionRatio = 1;

    return {
      stream,
      segments,
      durationMs,
      totalRawFrames,
      compressionRatio,
    };
  }
}

export const motionExtractionPipeline = new MotionExtractionPipeline();
