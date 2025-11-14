import { ComparisonResult } from '../types/pose.types';

class FeedbackGeneratorService {
  /**
   * Generate user-friendly feedback based on comparison result
   */
  generate(comparison: ComparisonResult): string[] {
    const feedback: string[] = [];

    // Overall performance
    if (comparison.overallScore >= 90) {
      feedback.push('🔥 Excellent! Your form is perfect!');
    } else if (comparison.overallScore >= 75) {
      feedback.push('👍 Great job! Keep it up!');
    } else if (comparison.overallScore >= 60) {
      feedback.push('💪 Good effort! You\'re improving!');
    } else {
      feedback.push('📚 Keep practicing! Focus on the basics');
    }

    // Timing feedback
    if (comparison.timingScore < 70) {
      feedback.push('⏱️ Focus on hitting exactly on the beat');
    } else if (comparison.timingScore >= 95) {
      feedback.push('⏱️ Perfect timing!');
    }

    // Precision feedback
    if (comparison.precisionScore < 70) {
      feedback.push('🎯 Check your positioning against the reference');
    } else if (comparison.precisionScore >= 90) {
      feedback.push('🎯 Excellent precision!');
    }

    // Isolation feedback
    if (comparison.isolationScore < 70) {
      feedback.push('🎭 Isolate your movements - keep other parts still');
    } else if (comparison.isolationScore >= 90) {
      feedback.push('🎭 Great isolation control!');
    }

    // Joint-specific feedback (from errors)
    if (comparison.errors.length > 0) {
      const topError = comparison.errors[0];
      feedback.push(`📍 ${topError}`);
    }

    return feedback.slice(0, 3); // Max 3 feedback items
  }

  /**
   * Generate encouragement based on progress
   */
  generateEncouragement(currentScore: number, previousScore: number): string {
    const improvement = currentScore - previousScore;
    
    if (improvement > 10) {
      return '🚀 Wow! Huge improvement!';
    } else if (improvement > 5) {
      return '📈 Nice progress!';
    } else if (improvement > 0) {
      return '✨ Getting better!';
    } else if (improvement === 0) {
      return '💪 Stay consistent!';
    } else {
      return '🎯 Keep trying! You got this!';
    }
  }
}

export const feedbackGenerator = new FeedbackGeneratorService();