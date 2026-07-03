import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { RootStackParamList } from './types';
import { MainTabNavigator } from './MainTabNavigator';
import { PracticeScreen } from '@/features/practice/screens/PracticeScreen';
import { VideoPracticeScreen } from '@/features/practice/screens/VideoPracticeScreen';
import { ResultsScreen } from '@/features/practice/screens/ResultsScreen';
import { VideoImportScreen } from '@/features/import/screens/VideoImportScreen';
import { VideoProcessingScreen } from '@/features/import/screens/VideoProcessingScreen';
import { MoveDetailScreen } from '@/features/moves/screens/MoveDetailScreen';
import { GoalSetupScreen } from '@/features/training/screens/GoalSetupScreen';
import { TrainingPlanScreen } from '@/features/training/screens/TrainingPlanScreen';
import { DaySessionDetailScreen } from '@/features/training/screens/DaySessionDetailScreen';
import { PlanPracticeScreen } from '@/features/training/screens/PlanPracticeScreen';
import { SessionStatsScreen } from '@/features/training/screens/SessionStatsScreen';
import { StreakScreen } from '@/features/profile/screens/StreakScreen';
import { CaloriesScreen } from '@/features/progress/screens/CaloriesScreen';
import { useShareExtension } from '@/features/import/hooks/useShareExtension';

const Stack = createStackNavigator<RootStackParamList>();

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export const AppNavigator = () => {
  useShareExtension(navigationRef);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
        <Stack.Screen name="Practice" component={PracticeScreen} />
        <Stack.Screen name="VideoPractice" component={VideoPracticeScreen} />
        <Stack.Screen name="Results" component={ResultsScreen} />
        <Stack.Screen name="MoveDetail" component={MoveDetailScreen} />
        <Stack.Screen name="VideoImport" component={VideoImportScreen} />
        <Stack.Screen name="VideoProcessing" component={VideoProcessingScreen} />
        <Stack.Screen name="GoalSetup" component={GoalSetupScreen} />
        <Stack.Screen name="TrainingPlan" component={TrainingPlanScreen} />
        <Stack.Screen name="DaySessionDetail" component={DaySessionDetailScreen} />
        <Stack.Screen name="PlanPractice" component={PlanPracticeScreen} />
        <Stack.Screen name="SessionStats" component={SessionStatsScreen} />
        <Stack.Screen name="Streak" component={StreakScreen} />
        <Stack.Screen name="Calories" component={CaloriesScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
