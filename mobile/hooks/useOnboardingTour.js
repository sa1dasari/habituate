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

const TourContext = createContext(null);

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

  useEffect(() => {
    if (!currentStep) {
      setTargetRect(null);
      return undefined;
    }
    if (currentStep.tab) navigateToTab(currentStep.tab, currentStep.tabParams);

    let cancelled = false;
    let attempts = 0;
    let timer = null;

    const tryMeasure = async () => {
      if (cancelled) return;
      if (!currentStep.targetKey) {
        setTargetRect(null);
        return;
      }
      const rect = await measureTourTarget(currentStep.targetKey);
      if (cancelled) return;
      if (rect) {
        setTargetRect(rect);
        return;
      }
      attempts += 1;
      // Keeps trying for ~4.5s — long enough for a tab switch plus a
      // pageSheet modal's slide-in animation to finish and lay out.
      if (attempts < 30) {
        timer = setTimeout(tryMeasure, 150);
      }
    };

    setTargetRect(null);
    // Small initial delay so the tab-switch/modal-open above has a frame to
    // start before the first measurement attempt.
    timer = setTimeout(tryMeasure, 220);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [currentStep]);

  // Re-measure immediately if the current step's target registers/relayouts
  // after the polling above already gave up, or moved (e.g. keyboard, font).
  useEffect(() => {
    if (!currentStep?.targetKey) return undefined;
    return onTourTargetRegistered(async (key) => {
      if (key !== currentStep.targetKey) return;
      const rect = await measureTourTarget(key);
      if (rect) setTargetRect(rect);
    });
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

  const value = useMemo(
    () => ({
      active,
      currentStep,
      stepIndex,
      totalSteps: TOUR_STEPS.length,
      targetRect,
      start,
      next,
      back,
      skip: finish,
      finish,
    }),
    [active, currentStep, stepIndex, targetRect, start, next, back, finish]
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
      .catch(() => {});
  }, [start]);
}

/** Account Settings → "Replay tour" calls this directly — the flag is
 * already set, so this just re-activates the walkthrough from step one. */
export function useReplayTour() {
  const { start } = useOnboardingTour();
  return start;
}
