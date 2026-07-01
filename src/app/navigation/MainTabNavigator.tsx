import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Svg, { Path, Circle } from 'react-native-svg';
import { MainTabParamList } from './types';
import { DashboardScreen } from '@/features/dashboard/screens/DashboardScreen';
import { ProgressScreen } from '@/features/progress/screens/ProgressScreen';
import { TrainingPlanScreen } from '@/features/training/screens/TrainingPlanScreen';
import { colors } from '@/config/theme/colors';

const Tab = createBottomTabNavigator<MainTabParamList>();

const iconWrap = {
  backgroundColor: colors.turquoiseTint,
  borderRadius: 10,
  paddingVertical: 4,
  paddingHorizontal: 10,
} as const;

const HomeIcon = ({ color }: { color: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Path d="M3 11l9-7 9 7" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M5 10v10h14V10" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const ProgressIcon = ({ color }: { color: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Path d="M4 19V9M12 19V5M20 19v-7" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const PlanIcon = ({ color }: { color: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Circle cx={12} cy={12} r={9} />
    <Path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(20,27,27,0.96)',
          borderTopColor: colors.border,
          height: 80,
          paddingBottom: 24,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => <View style={focused ? iconWrap : undefined}><HomeIcon color={color} /></View>,
        }}
      />
      <Tab.Screen
        name="Plan"
        component={TrainingPlanScreen}
        options={{
          tabBarLabel: 'Plan',
          tabBarIcon: ({ color, focused }) => <View style={focused ? iconWrap : undefined}><PlanIcon color={color} /></View>,
        }}
      />
      <Tab.Screen
        name="Progress"
        component={ProgressScreen}
        options={{
          tabBarLabel: 'Progress',
          tabBarIcon: ({ color, focused }) => <View style={focused ? iconWrap : undefined}><ProgressIcon color={color} /></View>,
        }}
      />
    </Tab.Navigator>
  );
};
