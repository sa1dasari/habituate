import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { HabitsProvider } from './hooks/useHabits';
import { GoalsProvider } from './hooks/useGoals';
import { CelebrationProvider } from './hooks/useCelebration';
import { AuthProvider, useAuth } from './hooks/useAuth';
import {
  CommunityScreen,
  HabitsScreen,
  InsightsScreen,
  LoginScreen,
  ProfileScreen,
  SignupScreen,
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

function AppGate() {
  const { user } = useAuth();
  const [showSignup, setShowSignup] = useState(false);

  // user === undefined means Firebase hasn't resolved the auth state yet
  if (user === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!user) {
    return showSignup
      ? <SignupScreen onGoToLogin={() => setShowSignup(false)} />
      : <LoginScreen onGoToSignup={() => setShowSignup(true)} />;
  }

  return (
    <HabitsProvider>
      <GoalsProvider>
        <CelebrationProvider>
          <NavigationContainer>
            <Tabs />
          </NavigationContainer>
        </CelebrationProvider>
      </GoalsProvider>
    </HabitsProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppGate />
      </AuthProvider>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
