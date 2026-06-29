import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

function getModule() {
  return Platform.OS === 'android' ? NativeModules.ShareModule : NativeModules.ShareBridgeModule;
}

function getPendingShareVideo(): Promise<string | null> {
  const mod = getModule();
  if (typeof mod?.getPendingShareVideo !== 'function') return Promise.resolve(null);
  return mod.getPendingShareVideo();
}

function subscribeToIncomingShare(cb: (videoUri: string) => void): () => void {
  const mod = NativeModules.ShareModule;
  if (Platform.OS !== 'android' || typeof mod?.addListener !== 'function') return () => {};
  const emitter = new NativeEventEmitter(mod);
  const sub = emitter.addListener('onIncomingShare', (payload: { videoUri: string }) => {
    cb(payload.videoUri);
  });
  return () => sub.remove();
}

export const shareBridge = { getPendingShareVideo, subscribeToIncomingShare };
