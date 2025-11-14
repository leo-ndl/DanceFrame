import { AI_CONSTANTS } from '@/config/constants/ai';

export class FrameProcessor {
  /**
   * Preprocess camera frame for MoveNet model
   * Converts frame data to Float32Array with normalization
   */
  static preprocessFrame(
    frameData: ArrayBuffer | Uint8Array,
    width: number,
    height: number,
    targetSize: number = AI_CONSTANTS.MODEL_INPUT_SIZE
  ): Float32Array {
    // Convert to Uint8Array if needed
    const data = frameData instanceof ArrayBuffer 
      ? new Uint8Array(frameData)
      : frameData;

    // Calculate resize dimensions
    const resized = this.resizeImage(data, width, height, targetSize, targetSize);
    
    // Normalize to [-1, 1] range (required by MoveNet)
    const normalized = this.normalizePixels(resized);
    
    return normalized;
  }

  /**
   * Resize image data using bilinear interpolation
   */
  private static resizeImage(
    data: Uint8Array,
    srcWidth: number,
    srcHeight: number,
    dstWidth: number,
    dstHeight: number
  ): Uint8Array {
    const output = new Uint8Array(dstWidth * dstHeight * 4);
    
    const xRatio = srcWidth / dstWidth;
    const yRatio = srcHeight / dstHeight;

    for (let y = 0; y < dstHeight; y++) {
      for (let x = 0; x < dstWidth; x++) {
        const srcX = Math.floor(x * xRatio);
        const srcY = Math.floor(y * yRatio);
        
        const srcIdx = (srcY * srcWidth + srcX) * 4;
        const dstIdx = (y * dstWidth + x) * 4;
        
        // Copy RGBA values
        output[dstIdx] = data[srcIdx];         // R
        output[dstIdx + 1] = data[srcIdx + 1]; // G
        output[dstIdx + 2] = data[srcIdx + 2]; // B
        output[dstIdx + 3] = data[srcIdx + 3]; // A
      }
    }
    
    return output;
  }

  /**
   * Normalize pixel values from [0, 255] to [-1, 1]
   */
  private static normalizePixels(data: Uint8Array): Float32Array {
    const normalized = new Float32Array((data.length / 4) * 3); // RGB only
    
    let outIdx = 0;
    for (let i = 0; i < data.length; i += 4) {
      // Normalize RGB channels, skip Alpha
      normalized[outIdx++] = (data[i] / 255.0) * 2.0 - 1.0;         // R
      normalized[outIdx++] = (data[i + 1] / 255.0) * 2.0 - 1.0;     // G
      normalized[outIdx++] = (data[i + 2] / 255.0) * 2.0 - 1.0;     // B
    }
    
    return normalized;
  }

  /**
   * Convert model output to keypoints
   * MoveNet output format: [y, x, confidence] for each keypoint
   */
  static parseModelOutput(output: Float32Array): Array<{x: number; y: number; score: number}> {
    const keypoints = [];
    const numKeypoints = AI_CONSTANTS.TFLITE.NUM_KEYPOINTS;
    
    for (let i = 0; i < numKeypoints; i++) {
      const idx = i * 3;
      keypoints.push({
        y: output[idx],         // Y coordinate (normalized 0-1)
        x: output[idx + 1],     // X coordinate (normalized 0-1)
        score: output[idx + 2], // Confidence score (0-1)
      });
    }
    
    return keypoints;
  }
}