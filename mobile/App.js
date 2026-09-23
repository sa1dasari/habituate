import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/nunito';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { HabitsProvider } from './hooks/useHabits';
import { GoalsProvider } from './hooks/useGoals';
import { CelebrationProvider } from './hooks/useCelebration';
import { ThemeProvider, useAppTheme } from './hooks/useAppTheme';
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

SplashScreen.preventAutoHideAsync().catch(() => {});

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
  const { colors } = useAppTheme();

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
  const { colors, effectiveMode } = useAppTheme();
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

  const navigationTheme = {
    ...(effectiveMode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(effectiveMode === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.surface,
      border: colors.border,
      primary: colors.accent,
      text: colors.textPrimary,
    },
  };

  return (
    <HabitsProvider>
      <GoalsProvider>
        <CelebrationProvider>
          <NavigationContainer theme={navigationTheme}>
            <Tabs />
          </NavigationContainer>
        </CelebrationProvider>
      </GoalsProvider>
    </HabitsProvider>
  );
}

function AppShell() {
  const { effectiveMode } = useAppTheme();
  return (
    <AuthProvider>
      <AppGate />
      <StatusBar style={effectiveMode === 'dark' ? 'light' : 'dark'} />
    </AuthProvider>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  const ready = fontsLoaded || fontError;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppShell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
