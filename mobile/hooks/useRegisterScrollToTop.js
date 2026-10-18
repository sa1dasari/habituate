import { useEffect, useRef } from 'react';
import { registerScrollRef, unregisterScrollRef } from '../utils/scrollToTopRegistry';

/**
 * Registers this screen's top-level ScrollView under `key` (its tab route
 * name) so App.js's Tab.Navigator can scroll it to top on every tabPress —
 * both re-tapping an already-active tab and switching into it from another
 * one, which is a broader behavior than React Navigation's own
 * useScrollToTop (that hook only fires on a re-tap while already focused).
 */
export function useRegisterScrollToTop(key) {
  const ref = useRef(null);

  useEffect(() => {
    registerScrollRef(key, ref);
    return () => unregisterScrollRef(key, ref);
  }, [key]);

  return ref;
}
