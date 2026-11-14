import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useHoldGesture } from '../hooks/useHoldGesture';
import { fonts } from '../theme';

/**
 * The bottom sheet's per-habit row button (design/skyline/01-skyline.png):
 * an outlined "Hold" pill that fills left-to-right with the category color as
 * the hold progresses, or a plain filled "✓ Built" pill once the day's
 * already done. Same gesture (timing, haptics, the undo-free `canBuild`
 * guard) as the on-tower hold — see useHoldGesture.js — just a different
 * visual (a fill sweep instead of a floor pouring in), since a text row
 * doesn't have a tower shape to animate.
 */
export default function HoldPillButton({ built, canBuild, tapToBuild, onBuild, color, label, theme }) {
  const { gesture, progress, lift, complete } = useHoldGesture({ canBuild: canBuild && !built, tapToBuild, onBuild });

  const animatedLift = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }],
  }));
  const animatedFill = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  if (built) {
    return (
      <View style={[styles.pill, styles.builtPill, { backgroundColor: theme.surfaceHigh }]}>
        <Text style={[styles.text, { color: theme.muted }]}>✓ Built</Text>
      </View>
    );
  }

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        testID={`habit-row-hold-${label}`}
        accessibilityRole="button"
        accessibilityLabel={`${label}, hold to build`}
        accessibilityActions={canBuild ? [{ name: 'activate', label: 'Build floor' }] : []}
        onAccessibilityAction={(event) => {
          if (canBuild && event.nativeEvent.actionName === 'activate') complete();
        }}
        style={[styles.pill, { borderColor: color }, animatedLift]}
      >
        <Animated.View style={[styles.fill, { backgroundColor: color }, animatedFill]} />
        <Text style={[styles.text, { color: theme.text }]}>Hold</Text>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: 96,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  builtPill: { borderWidth: 0 },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  text: { fontFamily: fonts.bold, fontSize: 15 },
});
