import { useEffect } from 'react';
import { Linking, Platform } from 'react-native';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import type { RootStackParamList } from '@/app/navigation/types';
import { shareBridge } from '@/core/ai/native/ShareBridge';

const IOS_TRIGGER_URL = 'danceframe://import-ready';

function navigateToProcessing(
  ref: NavigationContainerRefWithCurrent<RootStackParamList>,
  videoUri: string,
) {
  ref.current?.navigate('VideoProcessing', { videoUri });
}

export function useShareExtension(
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>,
) {
  // Cold-launch / bring-to-foreground: check for a pending video on mount (both platforms).
  useEffect(() => {
    let cancelled = false;
    shareBridge.getPendingShareVideo().then((uri) => {
      if (!cancelled && uri) navigateToProcessing(navigationRef, uri);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // iOS: share extension opens danceframe://import-ready; read the file via native bridge.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const handleURL = (event: { url: string }) => {
      if (!event.url.startsWith(IOS_TRIGGER_URL)) return;
      shareBridge.getPendingShareVideo().then((uri) => {
        if (uri) navigateToProcessing(navigationRef, uri);
      });
    };

    const subscription = Linking.addEventListener('url', handleURL);

    // App was closed when share was tapped — check initial URL once.
    Linking.getInitialURL().then((url) => {
      if (!url?.startsWith(IOS_TRIGGER_URL)) return;
      shareBridge.getPendingShareVideo().then((uri) => {
        if (uri) {
          // Short defer so NavigationContainer finishes mounting before we navigate.
          setTimeout(() => navigateToProcessing(navigationRef, uri), 150);
        }
      });
    });

    return () => subscription.remove();
  }, []);

  // Android: live event emitted when app is foregrounded via a share intent.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    return shareBridge.subscribeToIncomingShare((uri) => {
      navigateToProcessing(navigationRef, uri);
    });
  }, []);
}
