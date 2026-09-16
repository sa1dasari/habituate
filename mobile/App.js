import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
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

// Enough room for a 24px icon plus an 11px label; the device's bottom inset is
// added on top so the labels clear the home indicator / gesture bar instead of
// being squashed into the icons.
const TAB_BAR_CONTENT_HEIGHT = 58;

function Tabs() {
  const insets = useSafeAreaInsets();

  return (
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
          height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom,
        },
        tabBarIconStyle: { marginBottom: 0 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', lineHeight: 14 },
      })}
    >
      <Tab.Screen name="Today" component={TodayScreen} />
      <Tab.Screen name="Habits" component={HabitsScreen} />
      <Tab.Screen name="Insights" component={InsightsScreen} />
      <Tab.Screen name="Community" component={CommunityScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <HabitsProvider>
        <NavigationContainer>
          <Tabs />
        </NavigationContainer>
      </HabitsProvider>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
