import { useEffect, useRef } from 'react';
import { registerTourTarget, unregisterTourTarget } from '../utils/tourRegistry';

/** Attach the returned ref to whatever real element should be spotlighted
 * for this tour step (a Pressable, a View, a card) — e.g.
 * `ref={useTourTarget(TOUR_TARGETS.HABITS_ADD_BUTTON)}`. Pass a falsy key to
 * opt out (nothing registers). */
export function useTourTarget(key) {
  const ref = useRef(null);
  useEffect(() => {
    if (!key) return undefined;
    registerTourTarget(key, ref);
    return () => unregisterTourTarget(key, ref);
  }, [key]);
  return ref;
}
