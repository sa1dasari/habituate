import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * A module-level nav ref (same pattern as scrollToTopRegistry/tourRegistry)
 * so the onboarding tour can switch bottom tabs from useOnboardingTour,
 * which lives above the NavigationContainer and has no navigation prop of
 * its own to call. App.js passes this as the NavigationContainer's `ref`.
 */
export const navigationRef = createNavigationContainerRef();

export function navigateToTab(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}
