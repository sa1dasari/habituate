import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useHoldGesture } from '../hooks/useHoldGesture';
import { useTapToBuild } from '../hooks/useTapToBuild';
import { fonts, radii } from '../theme';

/**
 * Full-width "Hold to build" / "Hold to add today's floor" pill (boards 10
 * and 11) — same gesture as the main skyline's hold-to-build
 * (useHoldGesture.js: timing, haptics, the undo-free `canBuild` guard,
 * Accessibility's "Tap to build" override) and the same visual language as
 * HoldPillButton.js, just full-width with a caller-supplied label instead
 * of that component's fixed-width sheet-row sizing. Always the same gold
 * fill regardless of app theme — matching the mockups, which draw this one
 * exact color on both boards.
 */
export default function HoldToBuildBar({ built, canBuild, onBuild, label = 'Hold to build', builtLabel = 'Built today', testID }) {
  const { tapToBuild } = useTapToBuild();
  const { gesture, progress, lift, complete } = useHoldGesture({ canBuild: canBuild && !built, tapToBuild, onBuild });

  const animatedLift = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }],
  }));
  const animatedFill = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  if (built) {
    return (
      <Animated.View style={[styles.bar, styles.builtBar]} testID={testID}>
        <Text style={styles.builtText}>✓ {builtLabel}</Text>
      </Animated.View>
    );
  }

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={canBuild ? label : `${label}, unavailable`}
        accessibilityActions={canBuild ? [{ name: 'activate', label }] : []}
        onAccessibilityAction={(event) => {
          if (canBuild && event.nativeEvent.actionName === 'activate') complete();
        }}
        style={[styles.bar, !canBuild && styles.barDisabled, animatedLift]}
      >
        <Animated.View style={[styles.fill, animatedFill]} />
        <Text style={styles.text}>{label}</Text>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: '#F2C14E',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  barDisabled: { opacity: 0.5 },
  builtBar: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#F2C14E' },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#D9A62E',
  },
  text: { fontFamily: fonts.bold, fontSize: 16, color: '#1A1300' },
  builtText: { fontFamily: fonts.bold, fontSize: 16, color: '#F2C14E' },
});
