import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import api from '../api/client';

const STORAGE_KEY = '@habituate/pushToken';
const EXPLAINER_SHOWN_KEY = '@habituate/pushExplainerShown';

/**
 * expo-notifications' remote-push code path throws at call time (not just a
 * graceful no-op) when running inside classic Expo Go on SDK 53+ — merely
 * importing the module and touching its push-token APIs is enough to crash,
 * independent of platform. So the module is never statically imported here;
 * it's only dynamically imported after confirming this isn't Expo Go.
 *
 * `Constants.executionEnvironment === 'storeClient'` is true for BOTH Expo
 * Go and an expo-dev-client build (confirmed against expo-constants' own
 * type definitions) — not precise enough here, since a dev-client build is
 * exactly where this *should* run. `Constants.appOwnership === 'expo'` is
 * marked deprecated in favor of that, but it's the one that actually still
 * returns `'expo'` only for real Expo Go (`null` for a dev-client build) —
 * the deprecated field is the correct choice for this specific check.
 */
function isExpoGo() {
  return Constants.appOwnership === 'expo';
}

/** Shared by both the already-granted fast path and the explainer's "Allow"
 * button — registers this device's Expo push token once a 'granted' status
 * is confirmed. Never requests permission itself; the caller already has. */
async function registerToken(registeredTokenRef, cancelledRef) {
  try {
    const Notifications = await import('expo-notifications');
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      // No EAS project linked yet (`eas init`) — can't mint a token without one.
      if (__DEV__) console.log('[habituate] Skipping push registration: no EAS projectId configured.');
      return;
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (cancelledRef.current || !token) return;

    await api.registerPushToken(token, Platform.OS);
    registeredTokenRef.current = token;
    AsyncStorage.setItem(STORAGE_KEY, token).catch(() => {});
  } catch (err) {
    if (__DEV__) console.log('[habituate] Push registration skipped:', err?.message);
  }
}

async function setUpNotificationChannelIfNeeded() {
  const Notifications = await import('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

/**
 * Registers this device for habit-reminder push notifications once the user
 * is signed in, from inside a development build or standalone app. Sends
 * through Expo's push service (not raw FCM/APNs). A no-op inside Expo Go
 * itself (see isExpoGo above) — Expo Go dropped remote-push support on
 * Android in SDK 53 and this app isn't in a development build yet, so there
 * is nothing safe to register from there regardless of platform.
 *
 * Does NOT call the OS permission prompt directly when the decision is still
 * undetermined — see usePushPermissionPrompt below, which owns that moment
 * via a one-time in-app explainer. This hook only acts when permission is
 * already resolved (granted: register; denied/undetermined-but-already-
 * explained: stay silent, same as before).
 *
 * Silent no-op on any other failure in this chain — a missing reminder is
 * never worth surfacing an error over.
 */
export function usePushToken(enabled) {
  const registeredToken = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    if (isExpoGo()) {
      if (__DEV__) console.log('[habituate] Skipping push registration: not available inside Expo Go.');
      return;
    }

    const cancelledRef = { current: false };

    async function run() {
      try {
        if (!Device.isDevice) return; // simulators/emulators don't have push capability

        await setUpNotificationChannelIfNeeded();
        const Notifications = await import('expo-notifications');
        const { status } = await Notifications.getPermissionsAsync();

        if (status === 'granted') {
          await registerToken(registeredToken, cancelledRef);
          return;
        }

        // Not granted: the explainer (usePushPermissionPrompt, mounted once
        // near the app root) owns asking from here — this effect never calls
        // requestPermissionsAsync itself, so a returning user whose decision
        // is still 'undetermined' (dismissed "Not now" last time) is never
        // silently re-prompted by the OS without the explainer's context.
      } catch (err) {
        if (__DEV__) console.log('[habituate] Push registration check skipped:', err?.message);
      }
    }

    run();

    return () => {
      cancelledRef.current = true;
    };
  }, [enabled]);
}

/**
 * Owns the one-time, in-app "why we want this" explainer shown before the
 * OS permission dialog — Duolingo's documented strategy: frame the value
 * before the system prompt, since a denied OS prompt is much harder to walk
 * back than a skipped in-app screen. Shown at most once ever per device
 * (AsyncStorage flag), and only when permission is still genuinely
 * undetermined — already granted or already denied (via OS settings, or an
 * earlier install) skips straight past it, nothing to ask.
 *
 * "Not now" marks the explainer shown and does nothing further — no OS
 * prompt fires now or automatically later. The user can still enable it any
 * time from Account Settings → Notifications → "Open notification
 * settings", which already exists independent of this hook.
 */
export function usePushPermissionPrompt(enabled) {
  const [visible, setVisible] = useState(false);
  const registeredToken = useRef(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!enabled || isExpoGo()) return;
    cancelledRef.current = false;

    (async () => {
      try {
        if (!Device.isDevice) return;

        const alreadyShown = await AsyncStorage.getItem(EXPLAINER_SHOWN_KEY);
        if (alreadyShown) return;

        const Notifications = await import('expo-notifications');
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'undetermined' || cancelledRef.current) return;

        setVisible(true);
      } catch (err) {
        if (__DEV__) console.log('[habituate] Push explainer check skipped:', err?.message);
      }
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [enabled]);

  const markShown = () => {
    AsyncStorage.setItem(EXPLAINER_SHOWN_KEY, '1').catch(() => {});
  };

  const onAllow = async () => {
    setVisible(false);
    markShown();
    try {
      await setUpNotificationChannelIfNeeded();
      const Notifications = await import('expo-notifications');
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        await registerToken(registeredToken, cancelledRef);
      }
    } catch (err) {
      if (__DEV__) console.log('[habituate] Push permission request skipped:', err?.message);
    }
  };

  const onDismiss = () => {
    setVisible(false);
    markShown();
  };

  return { visible, onAllow, onDismiss };
}

/**
 * Call on sign-out so a shared/reset device stops receiving the previous
 * account's reminders. Reads the last-registered token from AsyncStorage
 * rather than requiring the caller to have one in hand — sign-out can happen
 * from a screen that never called usePushToken directly.
 */
export async function unregisterPushToken() {
  try {
    const token = await AsyncStorage.getItem(STORAGE_KEY);
    if (!token) return;
    await api.unregisterPushToken(token);
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // best-effort — a stray token just goes unused server-side until Expo marks it dead
  }
}
