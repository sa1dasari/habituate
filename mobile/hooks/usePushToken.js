import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import api from '../api/client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Registers this device for habit-reminder push notifications once the user
 * is signed in. Sends through Expo's push service (not raw FCM/APNs), which
 * is what lets this work from inside Expo Go on iOS — Android needs a
 * development build for remote push as of Expo SDK 53+ (an Expo Go platform
 * limitation; this hook still runs there, it just won't get a token back).
 * Silent no-op on failure anywhere in this chain — a missing reminder is
 * never worth surfacing an error over.
 */
export function usePushToken(enabled) {
  const registeredToken = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function register() {
      try {
        if (!Device.isDevice) return; // simulators/emulators don't have push capability

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

/** Call on sign-out so a shared/reset device stops receiving the previous account's reminders. */
export async function unregisterPushToken(token) {
  if (!token) return;
  try {
    await api.unregisterPushToken(token);
  } catch {
    // best-effort — a stray token just goes unused server-side until Expo marks it dead
  }
}
