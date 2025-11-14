const isDev = __DEV__;

export const logger = {
  log: (...args: any[]) => {
    if (isDev) console.log('[DanceFrame]', ...args);
  },
  
  error: (...args: any[]) => {
    'worklet';
    if (isDev) console.error('[DanceFrame ERROR]', ...args);
  },
  
  warn: (...args: any[]) => {
    if (isDev) console.warn('[DanceFrame WARN]', ...args);
  },
  
  info: (...args: any[]) => {
    if (isDev) console.info('[DanceFrame INFO]', ...args);
  },
};