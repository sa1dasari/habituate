import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildStreakStates,
  buildTypography,
  darkColors,
  flameStopsForStreak,
  fonts,
  gradients,
  lightColors,
  radii,
  shadow,
  shadowLg,
  spacing,
} from '../theme';

const STORAGE_KEY = '@habituate/themeMode';

const ThemeContext = createContext(null);

/**
 * Mode is one of 'light' | 'dark' | 'system'. 'system' follows the OS
 * appearance setting (react-native's useColorScheme) so the app matches the
 * rest of the phone until someone explicitly overrides it — the override is
 * persisted so it survives app restarts.
 */
export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (!cancelled && (saved === 'light' || saved === 'dark' || saved === 'system')) {
          setModeState(saved);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = (next) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  const effectiveMode = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;
  const colors = effectiveMode === 'dark' ? darkColors : lightColors;

  const value = useMemo(() => {
    const typography = buildTypography(colors);
    const streakStates = buildStreakStates(colors);
    return {
      mode,
      effectiveMode,
      setMode,
      colors,
      spacing,
      radii,
      fonts,
      typography,
      shadow,
      shadowLg,
      gradients,
      streakStates,
      flameStopsForStreak,
      resolveStreakState: (status) => {
        const key = String(status || 'safe').replace(/-/g, '_');
        return streakStates[key] || streakStates.safe;
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colors, effectiveMode, mode]);

  // Brief blank frame while the persisted preference loads — same pattern as
  // App.js's font-loading gate, so it's consistent with existing startup flow.
  if (!loaded) return null;

  return createElement(ThemeContext.Provider, { value }, children);
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used inside a ThemeProvider');
  }
  return context;
}
