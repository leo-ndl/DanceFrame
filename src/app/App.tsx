import React, { useEffect } from 'react';
import { AppNavigator } from './navigation/AppNavigator';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { logger } from '@/shared/utils/logger';

function App(): React.JSX.Element {
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      logger.log('Initializing DanceFrame...');
    } catch (error) {
      logger.error('App initialization error:', error);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppNavigator />
    </GestureHandlerRootView>
  );
}

export default App;
