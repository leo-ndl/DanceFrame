import { Pose, Keypoint } from '@/features/practice/types/pose.types';
import { AI_CONSTANTS } from '@/config/constants/ai';
import { FrameProcessor } from './FrameProcessor';

export class PoseProcessor {
  /**
   * Convert raw model output to Pose object
   */
  static processPoseOutput(
    output: Float32Array,
    timestamp: number = Date.now()
  ): Pose {
    const rawKeypoints = FrameProcessor.parseModelOutput(output);
    
    const keypoints: Keypoint[] = rawKeypoints.map((kp, index) => ({
      name: AI_CONSTANTS.KEYPOINT_NAMES[index],
      x: kp.x,
      y: kp.y,
      confidence: kp.score,
    }));

    const overallConfidence = this.calculateOverallConfidence(keypoints);

    return {
      keypoints,
      timestamp,
      confidence: overallConfidence,
    };
  }

  /**
   * Calculate overall pose confidence
   */
  private static calculateOverallConfidence(keypoints: Keypoint[]): number {
    const validKeypoints = keypoints.filter(
      kp => kp.confidence >= AI_CONSTANTS.MIN_CONFIDENCE
    );
    
    if (validKeypoints.length === 0) return 0;
    
    const sum = validKeypoints.reduce((acc, kp) => acc + kp.confidence, 0);
    return sum / validKeypoints.length;
  }

  /**
   * Filter low-confidence keypoints
   */
  static filterLowConfidenceKeypoints(
    pose: Pose,
    minConfidence: number = AI_CONSTANTS.MIN_CONFIDENCE
  ): Pose {
    return {
      ...pose,
      keypoints: pose.keypoints.filter(kp => kp.confidence >= minConfidence),
    };
  }

  /**
   * Normalize pose relative to body size (useful for comparison)
   */
  static normalizePose(pose: Pose): Pose {
    // Find shoulders and hips for reference
    const leftShoulder = pose.keypoints.find(kp => kp.name === 'leftShoulder');
    const rightShoulder = pose.keypoints.find(kp => kp.name === 'rightShoulder');
    const leftHip = pose.keypoints.find(kp => kp.name === 'leftHip');
    const rightHip = pose.keypoints.find(kp => kp.name === 'rightHip');

    if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
      return pose; // Can't normalize without key points
    }

    // Calculate torso length for normalization
    const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
    const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
    const hipCenterX = (leftHip.x + rightHip.x) / 2;
    const hipCenterY = (leftHip.y + rightHip.y) / 2;

    const torsoLength = Math.sqrt(
      Math.pow(shoulderCenterX - hipCenterX, 2) +
      Math.pow(shoulderCenterY - hipCenterY, 2)
    );

    if (torsoLength === 0) return pose;

    // Normalize all keypoints relative to torso center and length
    const normalizedKeypoints = pose.keypoints.map(kp => ({
      ...kp,
      x: (kp.x - hipCenterX) / torsoLength,
      y: (kp.y - hipCenterY) / torsoLength,
    }));

    return {
      ...pose,
      keypoints: normalizedKeypoints,
    };
  }
}