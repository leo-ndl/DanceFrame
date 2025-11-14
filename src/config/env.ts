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
