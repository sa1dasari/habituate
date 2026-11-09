import { createContext, createElement, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@habituate/tapToBuild';

const TapToBuildContext = createContext(null);

/**
 * "Tap to build" (SKYLINE.md section 1/8): an Accessibility setting that
 * turns the Skyline's hold-to-build gesture into a plain tap. A Context
 * provider, not a bare AsyncStorage-backed hook (contrast
 * useNotificationSwipePrefs.js) — AccessibilityScreen (where it's toggled)
 * and SkylineScreen (where it changes gesture behavior) are different
 * screens in different navigators, mounted at the same time once the app
 * is past login, so two independent hook instances would go stale relative
 * to each other the moment one of them wrote a new value.
 */
export function TapToBuildProvider({ children }) {
  const [tapToBuild, setTapToBuildState] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!cancelled && raw != null) setTapToBuildState(raw === 'true');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setTapToBuild = useCallback((value) => {
    setTapToBuildState(value);
    AsyncStorage.setItem(STORAGE_KEY, value ? 'true' : 'false').catch(() => {});
  }, []);

  return createElement(TapToBuildContext.Provider, { value: { tapToBuild, setTapToBuild } }, children);
}

export function useTapToBuild() {
  const ctx = useContext(TapToBuildContext);
  if (!ctx) throw new Error('useTapToBuild must be used within a TapToBuildProvider');
  return ctx;
}
