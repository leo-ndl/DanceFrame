
export interface TFLiteModel {
  run: (input: Float32Array) => Promise<Float32Array>;
  dispose: () => Promise<void>;
}

export interface ModelConfig {
  defaultPath: any;
  modelPath: string;
  inputSize: number;
  numKeypoints: number;
  numChannels: number;
}

export interface PoseDetectionResult {
  keypoints: Array<{
    x: number;
    y: number;
    score: number;
  }>;
  score: number;
}