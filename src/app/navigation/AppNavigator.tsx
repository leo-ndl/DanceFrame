import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { RootStackParamList } from './types';
import { MainTabNavigator } from './MainTabNavigator';
import { PracticeScreen } from '@/features/practice/screens/PracticeScreen';
import { ResultsScreen } from '@/features/practice/screens/ResultsScreen';
import { VideoImportScreen } from '@/features/import/screens/VideoImportScreen';
import { VideoProcessingScreen } from '@/features/import/screens/VideoProcessingScreen';
import { MoveDetailScreen } from '@/features/moves/screens/MoveDetailScreen';

const Stack = createStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
        <Stack.Screen name="Practice" component={PracticeScreen} />
        <Stack.Screen name="Results" component={ResultsScreen} />
        <Stack.Screen name="MoveDetail" component={MoveDetailScreen} />
        <Stack.Screen name="VideoImport" component={VideoImportScreen} />
        <Stack.Screen name="VideoProcessing" component={VideoProcessingScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};