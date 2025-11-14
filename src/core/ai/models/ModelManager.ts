import { loadTensorflowModel } from 'react-native-fast-tflite';
import { ModelConfig } from '../types/ml.types';
import { MODEL_CONFIG } from '../config/modelConfig';
import { logger } from '@/shared/utils/logger';

type ModelType = 'lightning' | 'thunder';

class ModelManager {
  private static instance: ModelManager;
  private models: Map<ModelType, any> = new Map();
  private isInitialized = false;

  private constructor() {}

  static getInstance(): ModelManager {
    if (!ModelManager.instance) {
      ModelManager.instance = new ModelManager();
    }
    return ModelManager.instance;
  }

  async initialize(modelType: ModelType = 'lightning'): Promise<void> {
    if (this.isInitialized) {
      logger.log('ModelManager already initialized');
      return;
    }

    try {
      logger.log(`Initializing TensorFlow Lite model: ${modelType}...`);
      
      const config : ModelConfig = MODEL_CONFIG[modelType];
      const model = await loadTensorflowModel(config.defaultPath);
      
      this.models.set(modelType, model);
      // Warm up the model
      await this.warmUp(model, config.inputSize);
      
      this.isInitialized = true;
      logger.log(`Model ${modelType} initialized successfully`);
    } catch (error) {
      logger.error('Failed to initialize model:', error);
      throw new Error(`Model initialization failed: ${error}`);
    }
  }

  private async warmUp(model: any, inputSize: number): Promise<void> {
    try {
      logger.log('Warming up model...');
      const dummyInput = new Uint8Array(inputSize * inputSize * 3);
       // Fill with 127 (~0.5 in 0–255 scale)
      for (let i = 0; i < dummyInput.length; i++) {
        dummyInput[i] = 127;
      }
      await model.run([dummyInput]);
      logger.log('Model warm-up complete');
    } catch (error) {
      logger.warn('Model warm-up failed:', error);
    }
  }

  getModel(type: ModelType = 'lightning'): any {
    if (!this.isInitialized) {
      throw new Error('ModelManager not initialized. Call initialize() first.');
    }
    
    const model = this.models.get(type);
    if (!model) {
      throw new Error(`Model ${type} not found`);
    }
    
    return model;
  }

  async dispose(): Promise<void> {
    logger.log('Disposing models...');
    
    for (const [name, model] of this.models) {
      try {
        if (model && typeof model.dispose === 'function') {
          await model.dispose();
        }
        logger.log(`Disposed model: ${name}`);
      } catch (error) {
        logger.error(`Failed to dispose model ${name}:`, error);
      }
    }
    
    this.models.clear();
    this.isInitialized = false;
    logger.log('All models disposed');
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

export const modelManager = ModelManager.getInstance();