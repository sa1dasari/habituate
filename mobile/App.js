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
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AvatarImage from './components/AvatarImage';
import { HabitsProvider } from './hooks/useHabits';
import { GoalsProvider } from './hooks/useGoals';
import { FriendsProvider } from './hooks/useFriends';
import { GroupsProvider } from './hooks/useGroups';
import { ChallengesProvider } from './hooks/useChallenges';
import { GroupActivityProvider } from './hooks/useGroupActivity';
import { NotificationsProvider } from './hooks/useNotifications';
import { CelebrationProvider } from './hooks/useCelebration';
import { ThemeProvider, useAppTheme } from './hooks/useAppTheme';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { usePushToken } from './hooks/usePushToken';
import { TourProvider, useAutoStartTour } from './hooks/useOnboardingTour';
import api from './api/client';
import { scrollToTop } from './utils/scrollToTopRegistry';
import { navigationRef } from './utils/navigationRef';
import {
  ChooseUsernameScreen,
  CommunityScreen,
  HabitsScreen,
  InsightsScreen,
  LoginScreen,
  SignupScreen,
  TodayScreen,
} from './screens';
import ProfileStack from './navigation/ProfileStack';

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
  const { user } = useAuth();

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
      <Tab.Screen
        name="Today"
        component={TodayScreen}
        listeners={{ tabPress: () => scrollToTop('Today') }}
      />
      <Tab.Screen
        name="Habits"
        component={HabitsScreen}
        listeners={{ tabPress: () => scrollToTop('Habits') }}
      />
      <Tab.Screen
        name="Insights"
        component={InsightsScreen}
        listeners={{ tabPress: () => scrollToTop('Insights') }}
      />
      <Tab.Screen
        name="Community"
        component={CommunityScreen}
        listeners={{ tabPress: () => scrollToTop('Community') }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{
          tabBarIcon: ({ color, size, focused }) =>
            user?.photoURL ? (
              <AvatarImage
                uri={user.photoURL}
                name={user.displayName}
                size={size + 4}
                style={focused ? { borderWidth: 2, borderColor: color } : null}
              />
            ) : (
              <MaterialCommunityIcons name={TAB_ICONS.Profile} size={size} color={color} />
            ),
        }}
        listeners={{ tabPress: () => scrollToTop('Profile') }}
      />
    </Tab.Navigator>
  );
}

// Fires the first-time-user tour exactly once, right after AppGate renders
// the main tabs for the first time this session with the AsyncStorage flag
// still unset — see useOnboardingTour.js's useAutoStartTour for the exact
// signal. Mounted inside TourProvider, not inside NavigationContainer, since
// it only needs the tour's own start() (tab-switching goes through the
// module-level navigationRef, not a navigation prop).
function TourAutoStart() {
  const attemptAutoStart = useAutoStartTour();
  useEffect(() => {
    attemptAutoStart();
  }, [attemptAutoStart]);
  return null;
}

function AppGate() {
  const { user } = useAuth();
  const { colors, effectiveMode } = useAppTheme();
  const [showSignup, setShowSignup] = useState(false);
  // undefined = not checked yet, null = checked and missing, string = set
  const [username, setUsername] = useState(undefined);

  usePushToken(!!user);

  useEffect(() => {
    if (!user) {
      setUsername(undefined);
      return;
    }
    let cancelled = false;
    api
      .getUserProfile()
      .then((profile) => {
        if (!cancelled) setUsername(profile?.username || null);
      })
      .catch(() => {
        if (!cancelled) setUsername(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

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

  if (username === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // Mandatory for every account going forward — existing accounts predate
  // this field, so this gate is also how they get backfilled on next sign-in.
  if (!username) {
    return <ChooseUsernameScreen onDone={() => setUsername('set')} />;
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
        <FriendsProvider>
          <GroupsProvider>
            <ChallengesProvider>
              <GroupActivityProvider>
                <NotificationsProvider>
                  <CelebrationProvider>
                    <TourProvider>
                      <NavigationContainer ref={navigationRef} theme={navigationTheme}>
                        <Tabs />
                      </NavigationContainer>
                      <TourAutoStart />
                    </TourProvider>
                  </CelebrationProvider>
                </NotificationsProvider>
              </GroupActivityProvider>
            </ChallengesProvider>
          </GroupsProvider>
        </FriendsProvider>
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppShell />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
