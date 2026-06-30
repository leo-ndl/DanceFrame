import { PoseFrameResult } from '@/core/ai/types/ml.types';
import { MotionRepresentation, MovementSegment } from '../types/motion.types';
import { smoothPoseStream } from './TemporalSmoother';
import { compressPoseStream, findFidelityViolations, FIDELITY_THRESHOLD } from './AdaptiveCompressor';
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

    // Step 1: temporal smoothing (FR-3)
    const smoothed = smoothPoseStream(raw);

    // Step 2: adaptive compression with temporal anchor (FR-4, FR-5, FR-8)
    const compressed = compressPoseStream(smoothed, durationMs);

    // Step 2b: fidelity validation — re-insert dropped frames that cause
    // reconstruction error above threshold (FR-7)
    const violations = findFidelityViolations(smoothed, compressed, FIDELITY_THRESHOLD);
    const stream = violations.length > 0
      ? [...compressed, ...violations].sort((a, b) => a.timestamp - b.timestamp)
      : compressed;

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

    const compressionRatio =
      stream.length > 0 ? totalRawFrames / stream.length : 1;

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
