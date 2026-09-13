import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { HabitsProvider } from './hooks/useHabits';
import {
  CommunityScreen,
  HabitsScreen,
  InsightsScreen,
  ProfileScreen,
  TodayScreen,
} from './screens';
import { colors } from './theme';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Today: 'check-circle-outline',
  Habits: 'format-list-checks',
  Insights: 'chart-line',
  Community: 'account-group-outline',
  Profile: 'account-circle-outline',
};

export default function App() {
  return (
    <SafeAreaProvider>
      <HabitsProvider>
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerShown: false,
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons
                  name={TAB_ICONS[route.name] || 'circle-medium'}
                  size={size}
                  color={color}
                />
              ),
              tabBarActiveTintColor: colors.accent,
              tabBarInactiveTintColor: colors.textMuted,
              tabBarStyle: {
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
                height: 64,
                paddingTop: 8,
                paddingBottom: 12,
              },
              tabBarLabelStyle: { fontSize: 11, fontWeight: '600', paddingBottom: 4 },
            })}
          >
            <Tab.Screen name="Today" component={TodayScreen} />
            <Tab.Screen name="Habits" component={HabitsScreen} />
            <Tab.Screen name="Insights" component={InsightsScreen} />
            <Tab.Screen name="Community" component={CommunityScreen} />
            <Tab.Screen name="Profile" component={ProfileScreen} />
          </Tab.Navigator>
        </NavigationContainer>
      </HabitsProvider>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
