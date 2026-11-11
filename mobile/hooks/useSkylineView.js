import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@habituate/skylineView';

/**
 * Remembers the Skyline tab's last-picked view — 'daily' (towers) or 'lots'
 * (weekly/monthly, SKYLINE.md section 4a) — across app opens. Per-device UI
 * preference only, same AsyncStorage-backed pattern as
 * useNotificationSwipePrefs.js, not account data that needs to sync.
 * SkylineScreen is the only screen that reads this, so a plain hook is
 * enough — no Context needed (contrast useTapToBuild.js, which two
 * simultaneously-mounted screens both need to stay in sync with).
 */
export function useSkylineView() {
  const [view, setViewState] = useState('daily');

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!cancelled && (raw === 'daily' || raw === 'lots')) setViewState(raw);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setView = useCallback((next) => {
    setViewState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  return { view, setView };
}
