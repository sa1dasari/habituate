import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { auth } from '../firebase';
import api from '../api/client';
import { HabitWidget } from './HabitWidget';
import { WIDGET_SNAPSHOT_KEY } from '../utils/widgetSync';

/**
 * Registered from `index.js` via `registerWidgetTaskHandler` (outside the
 * React tree, per `react-native-android-widget`'s own requirement). This
 * runs in a **headless JS task inside the main app's own process/JS
 * bundle** — the key fact that makes Android's interactive check-in
 * genuinely real rather than a degraded deep-link fallback: the same
 * Firebase session this app already persists to AsyncStorage (see
 * `firebase.js`'s `getReactNativePersistence`) is reachable right here,
 * so there is no separate shared-storage auth bridge to build for Android
 * the way the iOS WidgetKit extension needs (see `targets/widget/*.swift`
 * for why iOS is different: a true separate OS process with no access to
 * this JS bundle at all).
 */

async function waitForAuthUser(timeoutMs = 4000) {
  if (auth.currentUser) return auth.currentUser;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsubscribe();
      resolve(auth.currentUser || null);
    }, timeoutMs);
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        clearTimeout(timer);
        unsubscribe();
        resolve(user);
      }
    });
  });
}

async function readSnapshot() {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_SNAPSHOT_KEY);
    return raw ? JSON.parse(raw).habits || [] : [];
  } catch {
    return [];
  }
}

async function renderCurrent(widgetInfo, renderWidget) {
  const snapshot = await readSnapshot();
  renderWidget(HabitWidget({ ...widgetInfo, snapshot }));
}

export async function widgetTaskHandler(props) {
  const { widgetInfo, widgetAction, clickAction, clickActionData, renderWidget } = props;

  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      await renderCurrent(widgetInfo, renderWidget);
      return;

    case 'WIDGET_CLICK':
      if (clickAction === 'CHECK_IN' && clickActionData?.habitId) {
        const habitId = Number(clickActionData.habitId);
        try {
          // Firebase's persisted session may not have rehydrated the
          // instant this headless task spins up — give it a short window
          // before giving up and falling back to opening the app.
          const user = await waitForAuthUser();
          if (!user) throw new Error('no-session');
          await api.createCheckIn(habitId);

          // Optimistic local update so the widget reflects the check-in
          // immediately, without waiting for the main app to be opened
          // and `useHabits`' refresh to re-sync the snapshot.
          const snapshot = await readSnapshot();
          const updated = snapshot.map((h) =>
            h.id === habitId ? { ...h, checkedInToday: true, currentStreak: (h.currentStreak || 0) + 1 } : h
          );
          try {
            await AsyncStorage.setItem(
              WIDGET_SNAPSHOT_KEY,
              JSON.stringify({ habits: updated, updatedAt: new Date().toISOString() })
            );
          } catch {}
          renderWidget(HabitWidget({ ...widgetInfo, snapshot: updated }));
        } catch (e) {
          // Degraded path: no session reachable (rare — would mean the
          // device is signed out) or the API call itself failed (offline,
          // 401 on an expired/invalid session, etc). Open the app straight
          // to that habit via the deep link `App.js` listens for, so the
          // user can finish the check-in from the already-authenticated
          // app instead of silently failing inside the widget.
          Linking.openURL(`habituate://checkin?habitId=${habitId}&source=widget`).catch(() => {});
          await renderCurrent(widgetInfo, renderWidget);
        }
        return;
      }

      if (clickAction === 'OPEN_APP') {
        Linking.openURL('habituate://').catch(() => {});
        return;
      }
      return;

    default:
      return;
  }
}

export default widgetTaskHandler;
