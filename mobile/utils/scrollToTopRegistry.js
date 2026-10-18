/**
 * A plain module-level registry (not React context) mapping a tab's route
 * name to the ref of its current top-level scrollable — deliberately outside
 * the component tree since the thing driving a scroll-to-top (a tabPress
 * event in App.js's Tab.Navigator) isn't a descendant of the screen it needs
 * to reach. Each screen registers/unregisters its own ref on mount/unmount;
 * App.js's tabPress listeners just call scrollToTop(routeName).
 */
const refsByKey = {};

export function registerScrollRef(key, ref) {
  refsByKey[key] = ref;
}

export function unregisterScrollRef(key, ref) {
  if (refsByKey[key] === ref) {
    delete refsByKey[key];
  }
}

export function scrollToTop(key) {
  const ref = refsByKey[key];
  if (ref && ref.current && typeof ref.current.scrollTo === 'function') {
    ref.current.scrollTo({ y: 0, animated: true });
  }
}
