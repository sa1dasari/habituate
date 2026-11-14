import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';
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
import { HabitsProvider, useHabits } from './hooks/useHabits';
import { FriendsProvider } from './hooks/useFriends';
import { GroupsProvider } from './hooks/useGroups';
import { ChallengesProvider } from './hooks/useChallenges';
import { GroupActivityProvider } from './hooks/useGroupActivity';
import { NotificationsProvider } from './hooks/useNotifications';
import { CelebrationProvider } from './hooks/useCelebration';
import { ThemeProvider, useAppTheme } from './hooks/useAppTheme';
import { TapToBuildProvider } from './hooks/useTapToBuild';
import { WindowCountProvider } from './hooks/useWindowCount';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { isExpoGo, usePushToken, usePushPermissionPrompt } from './hooks/usePushToken';
import PushPermissionModal from './components/PushPermissionModal';
import { TourProvider, useAutoStartTour } from './hooks/useOnboardingTour';
import api from './api/client';
import { scrollToTop } from './utils/scrollToTopRegistry';
import { navigateToTab, navigationRef } from './utils/navigationRef';
import {
  ChooseUsernameScreen,
  CommunityScreen,
  InsightsScreen,
  LoginScreen,
  SignupScreen,
  TodayScreen,
} from './screens';
import ProfileStack from './navigation/ProfileStack';
// Skyline rebuild dev screens only (SKYLINE.md section 11) — __DEV__-gated
// below, never shown in a release build. SkylineEngineScreen is the Phase 1
// fixture-only render check; SkylineScreen is Phase 2's real-data screen,
// not yet the live tab (TowerSheet-only actions like Shield Day and streak
// repair aren't reachable until Phase 3). Delete both dev entries and this
// comment once Phase 3 closes that gap and the real tab takes over.
import SkylineEngineScreen from './screens/dev/SkylineEngineScreen';
import SkylineScreen from './screens/SkylineScreen';

SplashScreen.preventAutoHideAsync().catch(() => {});

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Today: 'check-circle-outline',
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
        // Route name stays 'Today' (code name, same as habit/check-in/
        // streak elsewhere — every navigation.navigate('Today', ...) call
        // site keeps working unchanged). Only the visible label changes,
        // per CLAUDE.md's UI-wording table and the design-review-approved
        // small fixes (2026-11-13).
        options={{ tabBarLabel: 'Skyline' }}
        listeners={{ tabPress: () => scrollToTop('Today') }}
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
      {__DEV__ && (
        <Tab.Screen
          name="SkylineEngine"
          component={SkylineEngineScreen}
          options={{ title: 'Engine', tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="flask-outline" size={size} color={color} />
          ) }}
        />
      )}
      {__DEV__ && (
        <Tab.Screen
          name="SkylineReal"
          component={SkylineScreen}
          options={{ title: 'Skyline2', tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="office-building" size={size} color={color} />
          ) }}
        />
      )}
    </Tab.Navigator>
  );
}

/**
 * Degraded fallback for the home-screen widgets (SKILLS.md Phase 7): when
 * in-widget interactivity isn't available — iOS 16 and below (no App
 * Intents / interactive widget buttons) or Android's own task-handler path
 * hitting an error, see `widgets/widgetTaskHandler.js` — the widget opens
 * `habituate://checkin?habitId=<id>&source=widget` instead, which lands
 * here. The app is already authenticated by the time this runs (it's a
 * normal foreground launch, not a background task), so the check-in just
 * goes through the same `toggleCheckIn` the Today screen itself uses.
 * Renders nothing — this only ever has a side effect.
 */
function WidgetDeepLinkBridge() {
  const { toggleCheckIn, loading } = useHabits();

  useEffect(() => {
    const handleUrl = ({ url }) => {
      if (!url) return;
      // Regex rather than the `URL` global — RN's URL polyfill handles
      // custom schemes inconsistently across SDK versions, and these
      // patterns (`habituate://checkin?habitId=123`,
      // `habituate://insights?habitId=123`) are simple enough not to need
      // a real parser.
      if (/^habituate:\/\/checkin\b/.test(url)) {
        const match = url.match(/habitId=(\d+)/);
        const habitId = match ? Number(match[1]) : null;
        if (!habitId || loading) return;
        toggleCheckIn(habitId).catch(() => {});
        navigateToTab('Today');
        return;
      }
      // A widget row for an already-done habit has nothing left to check
      // in — tapping it instead opens that habit's own Insights detail,
      // same destination Profile's habit list already links to.
      if (/^habituate:\/\/insights\b/.test(url)) {
        const match = url.match(/habitId=(\d+)/);
        const habitId = match ? Number(match[1]) : null;
        if (!habitId) return;
        navigateToTab('Insights', { openHabitId: habitId });
      }
    };

    Linking.getInitialURL().then((url) => url && handleUrl({ url }));
    const subscription = Linking.addEventListener('url', handleUrl);
    return () => subscription.remove();
  }, [toggleCheckIn, loading]);

  return null;
}

/**
 * Routes a tap on a real OS push notification (habit/challenge reminder) to
 * the right screen, same destination the in-app Notification Center already
 * uses for the same notification types (see NotificationCenterModal's
 * handlePress). No handling existed for this at all before — tapping a push
 * did nothing but open the app to wherever it last was.
 *
 * `expo-notifications` is dynamically imported, never statically — see the
 * comment on usePushToken's isExpoGo for why a static import crashes inside
 * Expo Go. getLastNotificationResponseAsync() catches the response that
 * cold-started the app (a plain listener alone only sees one received while
 * the JS runtime is already alive), same getInitialURL()-then-subscribe
 * shape WidgetDeepLinkBridge above uses for its own deep links.
 */
function PushNotificationTapBridge() {
  useEffect(() => {
    if (isExpoGo()) return undefined;

    let cancelled = false;
    let subscription;

    const route = (data) => {
      if (!data) return;
      if (data.habitId != null) {
        navigateToTab('Today', { highlightHabitId: Number(data.habitId) });
      } else if (data.challengeId != null) {
        navigateToTab('Community', { openChallengeId: Number(data.challengeId) });
      }
    };

    (async () => {
      try {
        const Notifications = await import('expo-notifications');
        const handleResponse = (response) => route(response?.notification?.request?.content?.data);

        const last = await Notifications.getLastNotificationResponseAsync();
        if (!cancelled && last) handleResponse(last);

        subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
      } catch (err) {
        if (__DEV__) console.log('[habituate] Push tap listener skipped:', err?.message);
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  return null;
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
  const pushPrompt = usePushPermissionPrompt(!!user);

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
      <FriendsProvider>
        <GroupsProvider>
          <ChallengesProvider>
            <GroupActivityProvider>
              <NotificationsProvider>
                <CelebrationProvider>
                  <TapToBuildProvider>
                    <WindowCountProvider>
                      <TourProvider>
                        <WidgetDeepLinkBridge />
                        <PushNotificationTapBridge />
                        <PushPermissionModal
                          visible={pushPrompt.visible}
                          onAllow={pushPrompt.onAllow}
                          onDismiss={pushPrompt.onDismiss}
                        />
                        <NavigationContainer ref={navigationRef} theme={navigationTheme}>
                          <Tabs />
                        </NavigationContainer>
                        <TourAutoStart />
                      </TourProvider>
                    </WindowCountProvider>
                  </TapToBuildProvider>
                </CelebrationProvider>
              </NotificationsProvider>
            </GroupActivityProvider>
          </ChallengesProvider>
        </GroupsProvider>
      </FriendsProvider>
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
