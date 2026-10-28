/**
 * Plain module-level registry mapping a tour step's target key to the native
 * view ref that should be spotlighted — same outside-the-tree pattern as
 * scrollToTopRegistry.js. Deliberately NOT a React context: the overlay for
 * any given step is rendered locally inside whichever screen/modal owns the
 * real element (so it stacks correctly even when that element lives inside
 * a native <Modal>, which renders in its own native layer above everything
 * else), but "which key is active right now" lives in useOnboardingTour,
 * which isn't a descendant of any one screen.
 */
const refsByKey = {};
const listeners = new Set();

export function registerTourTarget(key, ref) {
  refsByKey[key] = ref;
  listeners.forEach((fn) => fn(key));
}

export function unregisterTourTarget(key, ref) {
  if (refsByKey[key] === ref) {
    delete refsByKey[key];
  }
}

/** Fires whenever a target (re)registers — lets the tour re-measure a target
 * that mounts late (e.g. a modal still animating its content in). */
export function onTourTargetRegistered(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Resolves to {x, y, width, height} in window coordinates, or null if the
 * target isn't registered/mounted/laid-out yet. */
export function measureTourTarget(key) {
  return new Promise((resolve) => {
    const ref = refsByKey[key];
    if (!ref || !ref.current || typeof ref.current.measureInWindow !== 'function') {
      resolve(null);
      return;
    }
    try {
      ref.current.measureInWindow((x, y, width, height) => {
        if (!width && !height) {
          resolve(null);
          return;
        }
        resolve({ x, y, width, height });
      });
    } catch {
      resolve(null);
    }
  });
}
