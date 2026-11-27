import { createContext, createElement, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const STORAGE_KEY = '@habituate/floatingTabBar';

// Board 101's measurements — shared with components/FloatingTabBar.js so the
// bar's own size and every screen's reserved bottom space can't drift apart.
export const FLOATING_BAR_HEIGHT = 64;
export const FLOATING_BAR_BOTTOM_MARGIN = 12;
export const FLOATING_BAR_SIDE_MARGIN = 16;
export const FLOATING_BAR_RADIUS = 32;

const FloatingTabBarContext = createContext(null);

/**
 * Whether the bottom tab bar floats (boards 97/98, owner-approved
 * 2026-11-26) — a rounded, translucent bar with margin on every side,
 * content scrolling behind it — or stays docked full-width at the screen
 * edge, today's look (board 101's "Docked" column). Default true (floating)
 * per the owner's decision. A Context provider, not a bare hook — App.js's
 * tab bar and ProfileStack's Skyline settings screen (where it's toggled)
 * are mounted at the same time, same reasoning as useTapToBuild.js.
 */
export function FloatingTabBarProvider({ children }) {
  const [floatingTabBar, setFloatingTabBarState] = useState(true);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!cancelled && raw != null) setFloatingTabBarState(raw === 'true');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setFloatingTabBar = useCallback((value) => {
    setFloatingTabBarState(value);
    AsyncStorage.setItem(STORAGE_KEY, value ? 'true' : 'false').catch(() => {});
  }, []);

  return createElement(FloatingTabBarContext.Provider, { value: { floatingTabBar, setFloatingTabBar } }, children);
}

export function useFloatingTabBar() {
  const ctx = useContext(FloatingTabBarContext);
  if (!ctx) throw new Error('useFloatingTabBar must be used within a FloatingTabBarProvider');
  return ctx;
}

/**
 * How much extra bottom space a tab screen's own scrollable content needs
 * so its last row can clear the floating bar (board 101: "every screen adds
 * bottom padding of 64 + 12 + the safe-area inset"). Zero when docked — the
 * docked bar is still a normal in-flow sibling that already reserves its own
 * space, same as before this feature existed. Add this on top of whatever
 * bottom padding a screen already has, don't replace it.
 */
export function useTabBarOverlayInset() {
  const { floatingTabBar } = useFloatingTabBar();
  const insets = useSafeAreaInsets();
  return floatingTabBar ? FLOATING_BAR_HEIGHT + FLOATING_BAR_BOTTOM_MARGIN + insets.bottom : 0;
}
