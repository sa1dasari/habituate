import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import api from '../api/client';

const STORAGE_KEY = '@habituate/pushToken';

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

/**
 * Registers this device for habit-reminder push notifications once the user
 * is signed in, from inside a development build or standalone app. Sends
 * through Expo's push service (not raw FCM/APNs). A no-op inside Expo Go
 * itself (see isExpoGo above) — Expo Go dropped remote-push support on
 * Android in SDK 53 and this app isn't in a development build yet, so there
 * is nothing safe to register from there regardless of platform.
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

    let cancelled = false;

    async function register() {
      try {
        if (!Device.isDevice) return; // simulators/emulators don't have push capability

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

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let status = existingStatus;
        if (status !== 'granted') {
          const requested = await Notifications.requestPermissionsAsync();
          status = requested.status;
        }
        if (status !== 'granted' || cancelled) return;

        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) {
          // No EAS project linked yet (`eas init`) — can't mint a token without one.
          if (__DEV__) console.log('[habituate] Skipping push registration: no EAS projectId configured.');
          return;
        }

        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
        if (cancelled || !token) return;

        await api.registerPushToken(token, Platform.OS);
        registeredToken.current = token;
        AsyncStorage.setItem(STORAGE_KEY, token).catch(() => {});
      } catch (err) {
        if (__DEV__) console.log('[habituate] Push registration skipped:', err?.message);
      }
    }

    register();

    return () => {
      cancelled = true;
    };
  }, [enabled]);
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
