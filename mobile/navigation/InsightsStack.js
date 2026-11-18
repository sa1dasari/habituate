import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import InsightsScreen from '../screens/InsightsScreen';
import InsightsDetailScreen from '../screens/InsightsDetailScreen';

const Stack = createNativeStackNavigator();

// The details page (design-review boards 31-33) is a real pushed screen so
// the Android back button returns to Insights. headerShown:false — it draws
// its own header row, same as ProfileStack's screens.
export default function InsightsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="InsightsMain" component={InsightsScreen} />
      <Stack.Screen name="InsightsDetail" component={InsightsDetailScreen} />
    </Stack.Navigator>
  );
}
