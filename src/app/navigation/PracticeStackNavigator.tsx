import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { PracticeScreen } from "@/features/practice/screens/PracticeScreen";
import { theme } from '@/config/theme';
import { PracticeStackParamList } from "./types";

const Stack = createStackNavigator<PracticeStackParamList>();

export const PracticeStackNavigator = () => {
    return (
        <Stack.Navigator
            screenOptions = {{
                headerShown: false,
                cardStyle: {
                    backgroundColor: theme.colors.background,
                },
            }}
        >
            <Stack.Screen name="Practice" component={PracticeScreen} />
        </Stack.Navigator>
    )
}