import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@habituate/notificationSwipePrefs';

/**
 * Client-only UI preference for which swipe direction on a notification row
 * triggers Delete vs Mark as read (NotificationCenterModal.js) — same
 * AsyncStorage-backed, no-backend-field pattern as
 * useFeaturedGoalReviews.js's dismissed-reviews state, since this is purely
 * a per-device interaction preference, not account data that needs to sync
 * across devices.
 *
 * Default ("Outlook-style"): swipe LEFT reveals Mark as read, swipe RIGHT
 * reveals Delete. Some users expect the opposite (iOS Mail: delete-on-left)
 * — `deleteOnLeft: true` swaps both directions at once so the two actions
 * never land on the same side.
 */
export function useNotificationSwipePrefs() {
  const [deleteOnLeft, setDeleteOnLeftState] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        if (raw) {
          const parsed = JSON.parse(raw);
          setDeleteOnLeftState(Boolean(parsed?.deleteOnLeft));
        }
      })
      .catch(() => {
        // Best-effort — fall back to the default mapping.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setDeleteOnLeft = useCallback((value) => {
    setDeleteOnLeftState(value);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ deleteOnLeft: value })).catch(() => {});
  }, []);

  return { deleteOnLeft, setDeleteOnLeft, loaded };
}
