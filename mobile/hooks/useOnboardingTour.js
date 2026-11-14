import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TOUR_STEPS } from '../constants/onboardingTour';
import { navigateToTab } from '../utils/navigationRef';
import { measureTourTarget, onTourTargetRegistered } from '../utils/tourRegistry';

const STORAGE_KEY = '@habituate/hasCompletedTour';
// Sub-pixel jitter between two real measurements of the same settled layout
// is normal; anything bigger means the layout genuinely moved (resized,
// safe-area insets just applied, etc.) and is worth one more look.
const RECT_MATCH_TOLERANCE = 1;

const TourContext = createContext(null);

function rectsMatch(a, b) {
  return (
    Math.abs(a.x - b.x) <= RECT_MATCH_TOLERANCE &&
    Math.abs(a.y - b.y) <= RECT_MATCH_TOLERANCE &&
    Math.abs(a.width - b.width) <= RECT_MATCH_TOLERANCE &&
    Math.abs(a.height - b.height) <= RECT_MATCH_TOLERANCE
  );
}

/**
 * Drives the first-time-user onboarding tour: which step is active, which
 * tab it needs, and the measured on-screen rect of whatever real element
 * that step is spotlighting (polled via tourRegistry since the destination
 * screen/modal may still be animating in when the step activates).
 *
 * Mount once, above the NavigationContainer (see App.js) — switching tabs
 * goes through the module-level navigationRef, not useNavigation(), since
 * this provider isn't a descendant of the navigator.
 */
export function TourProvider({ children }) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);

  const currentStep = active ? TOUR_STEPS[stepIndex] : null;

  // What TourHighlight actually RENDERS, kept one step behind `currentStep`
  // until that step's target is ready. `currentStep` itself still updates
  // the instant stepIndex changes — screens key their own side effects off
  // it directly (TodayScreen opening the real TowerForm/Shield info modal
  // in step with the walkthrough, for one) and that has to fire immediately
  // so the target exists to measure at all. But if TourHighlight rendered
  // straight off `currentStep` too, its title/body would flip to the new
  // step instantly while `targetRect` was still null/stale mid-measurement —
  // a visible flash of full-dim-no-spotlight, or the new copy pointing at
  // the old cutout, on every cross-tab/cross-scope step. Swapping title and
  // rect together, only once the new one is actually ready, removes both.
  const [displayStep, setDisplayStep] = useState(null);
  const [displayTargetRect, setDisplayTargetRect] = useState(null);

  useEffect(() => {
    if (!currentStep) {
      setTargetRect(null);
      setDisplayStep(null);
      setDisplayTargetRect(null);
      return undefined;
    }
    if (currentStep.tab) navigateToTab(currentStep.tab, currentStep.tabParams);

    let cancelled = false;
    let attempts = 0;
    let timer = null;
    let lastRect = null;

    const commit = (rect) => {
      if (cancelled) return;
      setTargetRect(rect);
      setDisplayStep(currentStep);
      setDisplayTargetRect(rect);
    };

    const tryMeasure = async () => {
      if (cancelled) return;
      if (!currentStep.targetKey) {
        commit(null);
        return;
      }
      const rect = await measureTourTarget(currentStep.targetKey);
      if (cancelled) return;
      if (rect) {
        // Android's edge-to-edge safe-area layout can take an extra frame
        // to settle right after a tab switch — a header measured the
        // instant it mounts can report a transient, too-high position
        // (safe-area insets not applied yet) that still passes the
        // truthy/non-zero check below, and a mismatched spotlight (seen
        // on-device: the ring landing up over the status bar instead of
        // around "+ New") got locked in as final. Require two consecutive
        // measurements to agree before committing, instead of trusting
        // whichever one happens to arrive first.
        if (lastRect && rectsMatch(lastRect, rect)) {
          commit(rect);
          return;
        }
        lastRect = rect;
        timer = setTimeout(tryMeasure, 80);
        return;
      }
      lastRect = null;
      attempts += 1;
      // Keeps trying for ~4.5s — long enough for a tab switch plus a
      // pageSheet modal's slide-in animation to finish and lay out. If it
      // never resolves, commit anyway with no rect (full-dim fallback)
      // rather than leaving the previous step on screen forever.
      if (attempts < 30) {
        timer = setTimeout(tryMeasure, 150);
      } else {
        commit(null);
      }
    };

    // Try immediately, not after an artificial delay — a same-tab step (most
    // of them: three Habits-tab steps in a row, two Insights-tab steps in a
    // row) has its target already mounted, so waiting here was pure added
    // latency before the callout appeared. A step that DOES need a tab
    // switch or a modal's slide-in to finish first just fails this first
    // attempt and picks it up on the very next 150ms retry below — the
    // retry loop was already the real safety net, this was never load-
    // bearing. displayStep/displayRect deliberately aren't touched here —
    // the previous step keeps rendering until tryMeasure actually has
    // something to show.
    tryMeasure();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [currentStep]);

  // Re-measure immediately if the current step's target registers/relayouts
  // after the polling above already gave up, or moved (e.g. keyboard, font).
  useEffect(() => {
    if (!currentStep?.targetKey) return undefined;
    let cancelled = false;
    const unsubscribe = onTourTargetRegistered(async (key) => {
      if (key !== currentStep.targetKey) return;
      const rect = await measureTourTarget(key);
      // currentStep itself may have moved on (Next/Back/Skip) during that
      // await — without this guard a late resolution here could overwrite
      // displayStep with a step that's no longer current, surviving into
      // whatever runs next (including a later start()).
      if (!cancelled && rect) {
        setTargetRect(rect);
        setDisplayStep(currentStep);
        setDisplayTargetRect(rect);
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [currentStep]);

  const finish = useCallback(() => {
    setActive(false);
    setStepIndex(0);
    AsyncStorage.setItem(STORAGE_KEY, 'true').catch(() => {});
  }, []);

  const start = useCallback(() => {
    setStepIndex(0);
    setActive(true);
    // Set immediately, not on completion — a force-quit mid-tour must not
    // retrigger it on next launch.
    AsyncStorage.setItem(STORAGE_KEY, 'true').catch(() => {});
  }, []);

  const next = useCallback(() => {
    setStepIndex((i) => {
      if (i + 1 >= TOUR_STEPS.length) {
        finish();
        return i;
      }
      return i + 1;
    });
  }, [finish]);

  const back = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const resolvedDisplayStep = displayStep ?? currentStep;

  const value = useMemo(
    () => ({
      active,
      currentStep,
      // What TourHighlight should actually render — see the comment above
      // displayStep's declaration. Falls back to currentStep/targetRect
      // while active is first becoming true, before the initial measure
      // pass has committed anything yet.
      displayStep: resolvedDisplayStep,
      displayStepIndex: resolvedDisplayStep ? TOUR_STEPS.indexOf(resolvedDisplayStep) : 0,
      displayTargetRect: displayStep ? displayTargetRect : targetRect,
      stepIndex,
      totalSteps: TOUR_STEPS.length,
      targetRect,
      start,
      next,
      back,
      skip: finish,
      finish,
    }),
    [active, currentStep, resolvedDisplayStep, displayStep, displayTargetRect, stepIndex, targetRect, start, next, back, finish]
  );

  return createElement(TourContext.Provider, { value }, children);
}

export function useOnboardingTour() {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error('useOnboardingTour must be used inside a TourProvider');
  }
  return ctx;
}

/**
 * First-login detection: this device has never started (or finished) the
 * tour before. Call once, right after AppGate clears the username gate for
 * the first time on a session — see App.js's <TourAutoStart/>. Deliberately
 * NOT "account just created" — see SKILLS.md's note on why an unset flag on
 * a pre-existing account is an accepted, documented tradeoff for v1.
 */
export function useAutoStartTour() {
  const { start } = useOnboardingTour();
  const triedRef = useRef(false);

  return useCallback(() => {
    if (triedRef.current) return;
    triedRef.current = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) start();
      })
      .catch((e) => {
        if (__DEV__) console.warn('useAutoStartTour: AsyncStorage.getItem failed', e);
      });
  }, [start]);
}

/** Account Settings → "Replay tour" calls this directly — the flag is
 * already set, so this just re-activates the walkthrough from step one. */
export function useReplayTour() {
  const { start } = useOnboardingTour();
  return start;
}
