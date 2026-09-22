import { createContext, createElement, useCallback, useContext, useState } from 'react';
import CheckInCelebration from '../components/CheckInCelebration';

const CelebrationContext = createContext(null);

/**
 * Mounted once at the app root so the celebration overlay can pop over
 * whichever tab is active, regardless of which screen triggered it
 * (Today's check-ins, the Habits list, or a goal's progress stepper).
 */
export function CelebrationProvider({ children }) {
  const [payload, setPayload] = useState(null);

  const celebrate = useCallback((next) => {
    if (next) setPayload(next);
  }, []);

  const dismiss = useCallback(() => setPayload(null), []);

  return createElement(
    CelebrationContext.Provider,
    { value: { celebrate } },
    children,
    createElement(CheckInCelebration, { payload, onDismiss: dismiss })
  );
}

export function useCelebration() {
  const context = useContext(CelebrationContext);
  if (!context) {
    throw new Error('useCelebration must be used inside a CelebrationProvider');
  }
  return context;
}
