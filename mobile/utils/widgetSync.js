import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../api/client';

/**
 * Bridges auth + today's-habits state from the main app's JS runtime into
 * the two home-screen widget surfaces (SKILLS.md Phase 7 "Home-screen widget
 * for quick check-in").
 *
 * Why two different mechanisms per platform, not one:
 * - **Android** (`react-native-android-widget`): a widget tap runs a
 *   "headless JS task" inside the SAME app process/JS bundle as the main
 *   app (see `widgets/widgetTaskHandler.js`) — Firebase's own persisted
 *   session (AsyncStorage-backed, see `firebase.js`) is already reachable
 *   there, so Android does NOT need a hand-rolled token cache. What it does
 *   need cached is the *habit snapshot* (name/color/streak/checked-today),
 *   because the widget's rendered view must come from AsyncStorage
 *   without waiting on a network round trip — see `WIDGET_SNAPSHOT_KEY`.
 * - **iOS** (WidgetKit extension, `targets/widget/*.swift`): a widget
 *   extension is a genuinely separate OS process with its own Swift
 *   runtime — it has no access to this JS bundle, AsyncStorage, or the
 *   Firebase JS SDK's session at all. The only channel across that process
 *   boundary is an **App Group**. This module mirrors the same snapshot
 *   plus a minimal auth bundle (current ID token + its expiry + the
 *   refresh token + the Firebase Web API key) into the App Group's shared
 *   UserDefaults via `react-native-shared-group-preferences`, so the Swift
 *   `CheckInIntent` can call the check-in API directly — refreshing the ID
 *   token itself via `securetoken.googleapis.com` if it's expired, using
 *   only the cached refresh token (a plain REST call, no Firebase SDK
 *   needed on the Swift side). See that file's comments for exactly how,
 *   and for the fallback when even that isn't possible.
 */

export const WIDGET_SNAPSHOT_KEY = '@habituate/widget-snapshot';
export const WIDGET_AUTH_KEY = '@habituate/widget-auth';

// Must match `app.json`'s widget plugin config and
// `targets/widget/expo-target.config.js`. This is also one of the manual
// setup steps a human has to do in both the Apple Developer portal (register
// the App Group ID) and Xcode (the main app target needs the same App Group
// capability turned on) — see the final report / CLAUDE.md note for the
// full list of console steps that can't be done from this codebase alone.
export const IOS_APP_GROUP = 'group.com.habituate.mobile.widget';

let SharedGroupPreferences = null;
if (Platform.OS === 'ios') {
  try {
    // Optional dependency — only required once the iOS widget target
    // actually exists (i.e. after `expo prebuild`/EAS build picks up
    // `@bacons/apple-targets`). Guarded so Android/web never need it.
    SharedGroupPreferences = require('react-native-shared-group-preferences').default;
  } catch {
    SharedGroupPreferences = null;
  }
}

async function writeIOSAppGroup(key, value) {
  if (!SharedGroupPreferences) return;
  try {
    await SharedGroupPreferences.setItem(key, value, IOS_APP_GROUP);
  } catch (e) {
    // Best-effort — the extension just falls back to its deep-link path
    // (see CheckInIntent.swift) if this never lands.
    if (__DEV__) console.warn('[widgetSync] App Group write failed:', e?.message);
  }
}

/**
 * Called from `useHabits.js` every time the habit list refreshes. Keeps
 * only what a widget can actually use: not-yet-archived habits due today,
 * ranked the same way the Today screen ranks "Due Today" so the smallest
 * widget size shows the single most relevant habit.
 */
export async function syncHabitSnapshot(habits) {
  const today = (habits || [])
    .filter((h) => !h.archivedAt && h.dueToday !== false)
    .slice(0, 8)
    .map((h) => ({
      id: h.id,
      name: h.name,
      color: h.color || '#2563EB',
      category: h.category || 'General',
      currentStreak: h.currentStreak ?? 0,
      checkedInToday: !!h.checkedInToday,
      trackingMode: h.trackingMode || 'BOOLEAN',
    }));

  const payload = JSON.stringify({ habits: today, updatedAt: new Date().toISOString() });

  try {
    await AsyncStorage.setItem(WIDGET_SNAPSHOT_KEY, payload);
  } catch (e) {
    if (__DEV__) console.warn('[widgetSync] AsyncStorage snapshot write failed:', e?.message);
  }

  if (Platform.OS === 'ios') {
    await writeIOSAppGroup(WIDGET_SNAPSHOT_KEY, payload);
  }

  // Android: nudge the already-placed widgets to redraw with the new
  // snapshot immediately rather than waiting for their next scheduled
  // update. Dynamically required so this file has no hard Android-only
  // dependency when imported on iOS/web.
  if (Platform.OS === 'android') {
    try {
      const { requestWidgetUpdate } = require('react-native-android-widget');
      const { HabitWidget } = require('../widgets/HabitWidget');
      await requestWidgetUpdate({
        widgetName: 'HabitWidget',
        renderWidget: (widgetInfo) => HabitWidget({ ...widgetInfo, snapshot: today }),
      });
    } catch (e) {
      if (__DEV__) console.warn('[widgetSync] Android widget nudge failed:', e?.message);
    }
  }
}

/**
 * Called from `useAuth.js`'s `onIdTokenChanged` listener — fires on sign-in,
 * sign-out, and Firebase's own silent ~55-minute token refresh while the
 * app is open. Android ignores the raw token itself (see module doc above)
 * but iOS needs the refresh bundle kept current.
 */
export async function syncAuthToken(firebaseUser) {
  if (!firebaseUser) {
    try {
      await AsyncStorage.removeItem(WIDGET_AUTH_KEY);
    } catch {}
    if (Platform.OS === 'ios') await writeIOSAppGroup(WIDGET_AUTH_KEY, '');
    return;
  }

  if (Platform.OS !== 'ios') return; // Android never needs the raw token cached, see above.

  try {
    const idToken = await firebaseUser.getIdToken();
    // `getIdTokenResult` gives us the real expiry; `user.refreshToken` is the
    // long-lived token the Swift side uses to mint a fresh ID token itself
    // once this one expires, without ever needing the Firebase SDK.
    const result = await firebaseUser.getIdTokenResult();
    const payload = JSON.stringify({
      idToken,
      refreshToken: firebaseUser.refreshToken,
      expiresAt: result.expirationTime, // ISO string
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
      // So the Swift side hits the right environment (local dev vs
      // Railway production) without hardcoding it — see `api/client.js`'s
      // own `resolveBaseUrl()` for how this value is derived in-app.
      apiBaseUrl: API_BASE_URL,
    });
    await writeIOSAppGroup(WIDGET_AUTH_KEY, payload);
  } catch (e) {
    if (__DEV__) console.warn('[widgetSync] auth sync failed:', e?.message);
  }
}
