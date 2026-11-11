import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const HOLD_MS = 1000;

/**
 * The hold-to-build gesture state machine (SKYLINE.md section 8), shared by
 * every place a habit can be built from — the tower itself
 * (SkylineHoldLayer.js) and the bottom-sheet row's Hold pill
 * (SkylineHabitSheet.js) — so both call sites get identical timing, haptics,
 * and the undo-free guard, and only differ in what they render for
 * `progress`/`lift`.
 *
 * `canBuild` is the one correctness-critical input: when false (a BOOLEAN
 * habit already checked in today), the gesture is disabled entirely, so the
 * only check-in call this can ever trigger is the create path — never the
 * toggle-off/delete path. That's what makes a hold undo-free.
 *
 * Returns `{ gesture, progress, lift }` — `progress` (0→1 over ~1s) and
 * `lift` (0→-4) are shared values the caller animates its own visual from;
 * this hook owns no rendering.
 */
export function useHoldGesture({ canBuild, tapToBuild, onBuild }) {
  const progress = useSharedValue(0);
  const lift = useSharedValue(0);
  // Snaps to 1 the instant a hold begins (before progress has filled any),
  // 0 once it ends — a separate value from `progress` so a caller's "is the
  // in-progress indicator visible at all" and "how full is it" can animate
  // on independent timescales (the indicator appears instantly, the fill
  // itself ramps over the full hold).
  const active = useSharedValue(0);

  const liftUp = () => {
    lift.value = withTiming(-4, { duration: 100 });
  };
  const liftDown = () => {
    lift.value = withTiming(0, { duration: 150 });
  };
  const hideProgress = () => {
    active.value = withTiming(0, { duration: 120 });
    progress.value = withTiming(0, { duration: 120 });
  };
  const complete = () => {
    liftDown();
    hideProgress();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onBuild();
  };
  const startHold = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    liftUp();
    active.value = 1;
    progress.value = withTiming(1, { duration: HOLD_MS });
  };
  const cancelHold = () => {
    liftDown();
    hideProgress();
  };

  const longPress = Gesture.LongPress()
    .minDuration(HOLD_MS)
    .maxDistance(24)
    .enabled(canBuild && !tapToBuild)
    .onBegin(() => {
      runOnJS(startHold)();
    })
    .onStart(() => {
      runOnJS(complete)();
    })
    .onFinalize((_event, success) => {
      if (!success) runOnJS(cancelHold)();
    });

  const tap = Gesture.Tap()
    .enabled(canBuild && tapToBuild)
    .onBegin(() => {
      runOnJS(liftUp)();
    })
    .onStart(() => {
      runOnJS(complete)();
    })
    .onFinalize((_event, success) => {
      if (!success) runOnJS(liftDown)();
    });

  return { gesture: tapToBuild ? tap : longPress, progress, lift, active, complete };
}
