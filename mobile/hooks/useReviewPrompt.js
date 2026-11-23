import { useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { isReviewMilestone } from '../utils/reviewPrompt';

const STORAGE_KEY = '@habituate/hasPromptedReview';

/**
 * Fires the native App Store/Play Store review prompt at most once, ever,
 * on the first real streak-milestone celebration (SKYLINE.md Phase 8a).
 * `triedRef` avoids a redundant AsyncStorage read if a milestone fires
 * twice in the same session before the first check resolves.
 */
export function useReviewPrompt() {
  const triedRef = useRef(false);

  return useCallback(async (payload) => {
    if (triedRef.current) return;
    if (!isReviewMilestone(payload)) return;
    triedRef.current = true;
    try {
      const already = await AsyncStorage.getItem(STORAGE_KEY);
      if (already) return;
      // Set only once the native dialog actually ran, not before — unlike
      // the onboarding tour's start(), isAvailableAsync() can legitimately
      // say no (iOS's per-year quota already hit, a sideloaded/TestFlight
      // build, Play Services missing) and setting the flag first would burn
      // this user's one-ever chance on a no-op they never saw.
      if (await StoreReview.isAvailableAsync()) {
        await StoreReview.requestReview();
        await AsyncStorage.setItem(STORAGE_KEY, 'true');
      }
    } catch (e) {
      if (__DEV__) console.warn('useReviewPrompt: failed', e);
    }
  }, []);
}
