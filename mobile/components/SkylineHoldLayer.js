import React from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedProps, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { G, Path } from 'react-native-svg';
import { FLOOR_H, TOWER_W, previewFloorPaths } from '../utils/skylineScene';
import { useHoldGesture } from '../hooks/useHoldGesture';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

// Faces fade in during the last stretch of the hold, once the "pour" is
// mostly full — reads as the floor capping off rather than popping in.
const CAP_FADE_START = 0.7;

/**
 * One holdable tower overlay (SKYLINE.md section 8's gesture spec,
 * design/skyline/02-hold.png's three-stage feedback: press lifts the tower,
 * hold pours the floor in, release locks it with a haptic). Absolutely
 * positioned at `hit`'s coordinates by the parent, same coordinate space as
 * the scrolling Svg content so it scrolls in lockstep — see SkylineView.js's
 * `interactiveOverlay` slot, rendered inside its ScrollView for exactly
 * this reason.
 *
 * The hold preview draws the real incoming floor shape (previewFloorPaths,
 * the same geometry buildScene uses) growing from its base, rather than a
 * generic loading ring — "floor pours in," matching the mockup's own
 * language, and it previews the actual shape that's about to land.
 *
 * The gesture itself (timing, haptics, the undo-free `canBuild` guard) is
 * shared with the bottom sheet's row Hold pill via `useHoldGesture` — this
 * component only owns the floor-shaped visual.
 */
function HoldableTower({ hit, label, canBuild, tapToBuild, onBuild, onOpenSheet, theme }) {
  const { gesture: buildGesture, progress, lift, active, complete } = useHoldGesture({ canBuild, tapToBuild, onBuild });

  // SKYLINE.md section 8's gesture spec: "Tap opens the tower sheet. With
  // 'Tap to build' on, a tap builds the floor and a long press opens the
  // sheet" — the two roles swap with the same setting that swaps build
  // itself. Gesture.Exclusive gives the build gesture priority; the open
  // gesture only activates when the build one fails to recognize (e.g. a
  // press that's too short to satisfy LongPress's minDuration falls
  // through to the plain Tap below). Unverified on-device this round (ADB
  // was unavailable) — if a quick tap on a not-yet-built-today tower seems
  // to do nothing instead of opening the sheet, start here.
  const openSheetGesture = tapToBuild
    ? Gesture.LongPress()
        .minDuration(1000)
        .onStart(() => {
          if (onOpenSheet) runOnJS(onOpenSheet)();
        })
    : Gesture.Tap()
        // RNGH's Tap defaults to a 500ms maxDuration. The build long-press
        // needs the full 1000ms (HOLD_MS in useHoldGesture.js) to fail
        // before this Tap gets a turn in the Exclusive below, so without
        // raising this, any release between ~500ms and 1000ms satisfies
        // neither gesture and the tower does nothing at all.
        .maxDuration(1200)
        .onStart(() => {
          if (onOpenSheet) runOnJS(onOpenSheet)();
        });
  const gesture = Gesture.Exclusive(buildGesture, openSheetGesture);

  const animatedLift = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }],
  }));

  // hit.nextFloorY is in the main tower Svg's global scene coordinates;
  // this preview's own <Svg> is a small canvas local to the touchable
  // (origin at hit.x/hit.y on screen), so every coordinate used inside it
  // has to be converted into that local space first.
  const localAnchorY = hit.nextFloorY - hit.y; // bottom edge of the new floor
  const faces = previewFloorPaths(0, localAnchorY - FLOOR_H, TOWER_W);

  // Front/right/top faces of the incoming floor, growing from the bottom
  // edge upward as progress goes 0 -> 1 — a scale-from-base "pour," not a
  // generic fade, using a translate/scale/translate trick to anchor the
  // scale at the floor's bottom instead of its center.
  const animatedPourGroup = useAnimatedProps(() => ({
    transform: `translate(0 ${localAnchorY}) scale(1 ${progress.value}) translate(0 ${-localAnchorY})`,
    opacity: active.value,
  }));
  // The right/top "lid" faces only fade in once the pour is mostly full —
  // reads as the floor capping off, not popping in from nothing.
  const animatedCapOpacity = useAnimatedProps(() => ({
    opacity: Math.max(0, (progress.value - CAP_FADE_START) / (1 - CAP_FADE_START)),
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        testID={`skyline-hold-${hit.towerId}`}
        accessibilityRole="button"
        accessibilityLabel={label}
        // A screen reader fires this directly, bypassing the hold gesture
        // entirely — section 8/13's "screen reader gets an accessibility
        // action that checks in directly" rule.
        accessibilityActions={canBuild ? [{ name: 'activate', label: 'Build floor' }] : []}
        onAccessibilityAction={(event) => {
          if (canBuild && event.nativeEvent.actionName === 'activate') complete();
        }}
        style={[
          styles.touchable,
          { left: hit.x, top: hit.y, width: hit.width, height: hit.height },
          animatedLift,
        ]}
      >
        <Svg style={StyleSheet.absoluteFill} width={hit.width} height={hit.height}>
          <AnimatedG animatedProps={animatedPourGroup}>
            <Path d={faces.front} fill={theme.amber} opacity={0.85} />
            <AnimatedPath d={faces.right} fill={theme.amber} opacity={0.6} animatedProps={animatedCapOpacity} />
            <AnimatedPath d={faces.top} fill={theme.amber} opacity={0.95} animatedProps={animatedCapOpacity} />
          </AnimatedG>
        </Svg>
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * Renders one HoldableTower per scene hit target. `habitsById` and
 * `getCanBuild`/`onBuild` are supplied by the screen, which owns the actual
 * check-in call and the BOOLEAN-vs-COUNT branching (see SkylineScreen.js).
 */
export default function SkylineHoldLayer({ hitTargets, labels, getCanBuild, onBuild, onOpenSheet, tapToBuild, theme }) {
  return hitTargets.map((hit) => (
    <HoldableTower
      key={hit.towerId}
      hit={hit}
      label={labels[hit.towerId]}
      canBuild={getCanBuild(hit.towerId)}
      tapToBuild={tapToBuild}
      onBuild={() => onBuild(hit.towerId)}
      onOpenSheet={onOpenSheet ? () => onOpenSheet(hit.towerId) : undefined}
      theme={theme}
    />
  ));
}

const styles = StyleSheet.create({
  touchable: { position: 'absolute' },
});
