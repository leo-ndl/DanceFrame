interface AppConfig {
  API_URL: string;
  ENABLE_API: boolean;
  ENABLE_ANALYTICS: boolean;
  AI_MODEL_VERSION: string;
  CACHE_DURATION: number;
  USE_TENSORFLOW_LITE: boolean;
}

const ENV = {
  development: {
    API_URL: 'http://localhost:3000/api',
    ENABLE_API: false,
    ENABLE_ANALYTICS: false,
    AI_MODEL_VERSION: '1.0.0',
    CACHE_DURATION: 3600000,
    USE_TENSORFLOW_LITE: true,
  },
  production: {
    API_URL: 'https://api.danceframe.app',
    ENABLE_API: false,
    ENABLE_ANALYTICS: true,
    AI_MODEL_VERSION: '1.0.0',
    CACHE_DURATION: 86400000,
    USE_TENSORFLOW_LITE: true,
  },
};

const getEnvConfig = (): AppConfig => {
  const env = __DEV__ ? 'development' : 'production';
  return ENV[env];
};

export const config = getEnvConfig();

// Read from .env via react-native-config
// Add GEMINI_API_KEY=... to your .env file at the project root
import Config from 'react-native-config';
export const GEMINI_API_KEY: string = Config.GEMINI_API_KEY ?? '';
