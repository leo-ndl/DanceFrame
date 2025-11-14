import { Pose, Keypoint, ComparisonResult } from '../types/pose.types';
import { AI_CONSTANTS } from '@/config/constants/ai';

class MovementComparisonService {
  /**
   * Compare user pose with reference pose
   */
  compare(userPose: Pose, referencePose: Pose): ComparisonResult {
    const jointScores: Record<string, number> = {};
    const errors: string[] = [];

    // Compare each keypoint
    for (let i = 0; i < userPose.keypoints.length; i++) {
      const userKp = userPose.keypoints[i];
      const refKp = referencePose.keypoints[i];

      // Skip low confidence keypoints
      if (userKp.confidence < AI_CONSTANTS.MIN_CONFIDENCE) {
        continue;
      }

      // Calculate distance
      const distance = this.calculateDistance(userKp, refKp);
      const score = this.distanceToScore(distance);
      
      jointScores[userKp.name] = score;

      // Add error if score is low
      if (score < 70) {
        errors.push(`${this.formatJointName(userKp.name)} needs adjustment`);
      }
    }

    // Calculate component scores
    const precisionScore = this.calculatePrecisionScore(jointScores);
    const timingScore = this.calculateTimingScore(userPose, referencePose);
    const isolationScore = this.calculateIsolationScore(userPose, referencePose);
    
    const overallScore = (precisionScore + timingScore + isolationScore) / 3;

    return {
      overallScore: Math.round(overallScore),
      timingScore: Math.round(timingScore),
      precisionScore: Math.round(precisionScore),
      isolationScore: Math.round(isolationScore),
      jointScores,
      errors: errors.slice(0, 3), // Max 3 errors
    };
  }

  /**
   * Calculate Euclidean distance between two keypoints
   */
  private calculateDistance(kp1: Keypoint, kp2: Keypoint): number {
    const dx = kp1.x - kp2.x;
    const dy = kp1.y - kp2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Convert distance to score (0-100)
   */
  private distanceToScore(distance: number): number {
    // Distance threshold: 0.1 = 100%, 0.3 = 0%
    const normalized = Math.max(0, Math.min(1, (0.3 - distance) / 0.2));
    return normalized * 100;
  }

  /**
   * Calculate average precision score
   */
  private calculatePrecisionScore(jointScores: Record<string, number>): number {
    const scores = Object.values(jointScores);
    if (scores.length === 0) return 0;
    
    const sum = scores.reduce((acc, score) => acc + score, 0);
    return sum / scores.length;
  }

  /**
   * Calculate timing score based on timestamp difference
   */
  private calculateTimingScore(userPose: Pose, referencePose: Pose): number {
    const timeDiff = Math.abs(userPose.timestamp - referencePose.timestamp);
    const threshold = 150; // 150ms tolerance
    
    if (timeDiff <= threshold) {
      return 100 - (timeDiff / threshold) * 30;
    }
    return Math.max(0, 70 - timeDiff / 10);
  }

  /**
   * Calculate isolation quality (unwanted body parts moving)
   */
  private calculateIsolationScore(userPose: Pose, referencePose: Pose): number {
    const shouldMove = ['leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow', 'leftWrist', 'rightWrist'];
    const shouldStay = ['leftHip', 'rightHip', 'leftKnee', 'rightKnee'];
    
    let score = 100;
    
    // Check if parts that should stay still are moving
    shouldStay.forEach(name => {
      const userKp = userPose.keypoints.find(kp => kp.name === name);
      const refKp = referencePose.keypoints.find(kp => kp.name === name);
      
      if (userKp && refKp) {
        const movement = this.calculateDistance(userKp, refKp);
        if (movement > 0.05) {
          score -= 10;
        }
      }
    });
    
    return Math.max(0, score);
  }

  /**
   * Format joint name for display
   */
  private formatJointName(joint: string): string {
    return joint
      .replace(/([A-Z])/g, ' $1')
      .toLowerCase()
      .trim()
      .replace(/^./, str => str.toUpperCase());
  }
}

export const movementComparison = new MovementComparisonService();