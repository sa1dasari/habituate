import { createContext, createElement, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@habituate/skylineWindowCount';
export const WINDOW_COUNT_OPTIONS = [1, 2, 3, 4, 5];
const DEFAULT_WINDOW_COUNT = 3;

const WindowCountContext = createContext(null);

/**
 * How many windows each lit/dark floor draws (utils/skylineScene.js's
 * `windowCount` option) — an Accessibility setting. Context, not a bare
 * AsyncStorage hook (same reasoning as useTapToBuild.js): the Accessibility
 * screen that sets it and the Skyline screen that renders it are different,
 * simultaneously-mounted screens.
 */
export function WindowCountProvider({ children }) {
  const [windowCount, setWindowCountState] = useState(DEFAULT_WINDOW_COUNT);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const parsed = Number(raw);
        if (!cancelled && WINDOW_COUNT_OPTIONS.includes(parsed)) setWindowCountState(parsed);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setWindowCount = useCallback((value) => {
    setWindowCountState(value);
    AsyncStorage.setItem(STORAGE_KEY, String(value)).catch(() => {});
  }, []);

  return createElement(WindowCountContext.Provider, { value: { windowCount, setWindowCount } }, children);
}

export function useWindowCount() {
  const ctx = useContext(WindowCountContext);
  if (!ctx) throw new Error('useWindowCount must be used within a WindowCountProvider');
  return ctx;
}
