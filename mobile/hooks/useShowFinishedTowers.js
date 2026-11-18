import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GLOBAL_KEY = '@habituate/showFinishedTowers';
const OVERRIDES_KEY = '@habituate/showFinishedTowersOverrides';

const ShowFinishedTowersContext = createContext(null);

/**
 * Whether a finished tower (a closed segment of a still-active habit) draws
 * faded behind its active successor on the live skyline — a device-only
 * visual preference (board 57's Skyline settings row and board 15's Profile
 * row control the global default; board 45's per-habit toggle can override
 * it for one habit). Local-only, no backend (design-review confirmed this is
 * purely a display preference, not product data).
 *
 * A Context provider like useTapToBuild.js, not a bare hook — SkylineScreen
 * (reads it while building the scene) and the settings screens (where it's
 * toggled) are mounted at the same time, so two independent hook instances
 * would go stale relative to each other the moment one of them wrote a new
 * value.
 */
export function ShowFinishedTowersProvider({ children }) {
  const [global, setGlobalState] = useState(true);
  // habitId (string) -> true/false; absent means "use the global default".
  const [overrides, setOverridesState] = useState({});

  useEffect(() => {
    let cancelled = false;
    Promise.all([AsyncStorage.getItem(GLOBAL_KEY), AsyncStorage.getItem(OVERRIDES_KEY)])
      .then(([rawGlobal, rawOverrides]) => {
        if (cancelled) return;
        if (rawGlobal != null) setGlobalState(rawGlobal === 'true');
        if (rawOverrides) {
          try {
            setOverridesState(JSON.parse(rawOverrides) || {});
          } catch {
            // Corrupt stored value — fall back to no overrides rather than throwing.
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setShowFinishedTowers = useCallback((value) => {
    setGlobalState(value);
    AsyncStorage.setItem(GLOBAL_KEY, value ? 'true' : 'false').catch(() => {});
  }, []);

  // `value` of true/false sets an explicit override; null clears it back to
  // "use the global default".
  const setHabitOverride = useCallback((habitId, value) => {
    setOverridesState((prev) => {
      const next = { ...prev };
      if (value === null) {
        delete next[String(habitId)];
      } else {
        next[String(habitId)] = value;
      }
      AsyncStorage.setItem(OVERRIDES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const isVisibleForHabit = useCallback(
    (habitId) => {
      const override = overrides[String(habitId)];
      return override === undefined ? global : override;
    },
    [overrides, global],
  );

  const value = useMemo(
    () => ({
      showFinishedTowers: global,
      setShowFinishedTowers,
      habitOverrides: overrides,
      setHabitOverride,
      isVisibleForHabit,
    }),
    [global, setShowFinishedTowers, overrides, setHabitOverride, isVisibleForHabit],
  );

  return createElement(ShowFinishedTowersContext.Provider, { value }, children);
}

export function useShowFinishedTowers() {
  const ctx = useContext(ShowFinishedTowersContext);
  if (!ctx) throw new Error('useShowFinishedTowers must be used within a ShowFinishedTowersProvider');
  return ctx;
}
