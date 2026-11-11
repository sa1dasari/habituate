import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import HoldPillButton from './HoldPillButton';
import { fonts } from '../theme';

export const SHEET_PEEK_HEIGHT = 170;
const EXPANDED_RATIO = 0.6; // how much of the stage the sheet covers when pulled up

/**
 * The persistent bottom sheet list below the skyline scene
 * (concept_screens/1-skyline-daily.png). A draggable card, not a sheet
 * locked to the bottom of the screen: collapsed it peeks a couple of rows
 * above the screen edge; dragging the handle up to roughly the middle of
 * the stage lets it scroll the full habit list on top of the skyline, same
 * as a native bottom sheet. `stageHeight` comes from the screen's own
 * onLayout (no hardcoded device height — CLAUDE.md section 7). Also the
 * full non-visual equivalent of the skyline for a screen reader (section
 * 13): every tower's name, run length, and build action are plain rows
 * here, not just shapes.
 */
export default function SkylineHabitSheet({ habits, getCanBuild, onBuild, tapToBuild, theme, stageHeight }) {
  const measured = stageHeight > 0;
  const collapsedY = measured ? Math.max(0, stageHeight - SHEET_PEEK_HEIGHT) : 0;
  const expandedY = measured ? Math.max(0, stageHeight - stageHeight * EXPANDED_RATIO) : 0;

  const translateY = useSharedValue(collapsedY);
  const startY = useSharedValue(collapsedY);
  // Drives the accessibility toggle's label/state — kept on the JS side
  // (not read off the shared value) since a screen reader needs a plain
  // boolean, not an animated frame value.
  const [expanded, setExpanded] = useState(false);

  // Keep the shared value in step as stageHeight settles (first layout pass
  // reports 0, then the real height) without snapping mid-drag. An effect,
  // not a render-phase write, so a stageHeight change (e.g. rotation) while
  // the sheet is open doesn't yank an expanded sheet shut.
  const lastCollapsedY = useRef(collapsedY);
  useEffect(() => {
    if (!measured || lastCollapsedY.current === collapsedY) return;
    lastCollapsedY.current = collapsedY;
    if (!expanded) translateY.value = collapsedY;
  }, [measured, collapsedY, expanded, translateY]);

  const snapTo = (target, nowExpanded) => {
    translateY.value = withSpring(target, { damping: 50, stiffness: 400 });
    setExpanded(nowExpanded);
  };

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          startY.value = translateY.value;
        })
        .onUpdate((event) => {
          const next = startY.value + event.translationY;
          translateY.value = Math.min(collapsedY, Math.max(expandedY, next));
        })
        .onEnd(() => {
          const midpoint = (collapsedY + expandedY) / 2;
          const nowExpanded = translateY.value < midpoint;
          runOnJS(snapTo)(nowExpanded ? expandedY : collapsedY, nowExpanded);
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collapsedY, expandedY],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        measured ? styles.sheet : styles.unmeasuredFallback,
        { backgroundColor: theme.surfaceLow },
        measured && { height: stageHeight },
        measured && animatedStyle,
      ]}
    >
      <GestureDetector gesture={panGesture}>
        <View
          style={styles.handleZone}
          testID="skyline-sheet-handle"
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Collapse habit list' : 'Expand habit list'}
          accessible
          onAccessibilityTap={() => snapTo(expanded ? collapsedY : expandedY, !expanded)}
        >
          <View style={[styles.handle, { backgroundColor: theme.muted }]} />
        </View>
      </GestureDetector>
      <ScrollView contentContainerStyle={styles.list}>
        {habits.map((habit) => {
          const canBuild = getCanBuild(habit.id);
          return (
            <View key={habit.id} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: habit.color }]} />
              <View style={styles.labelWrap}>
                <Text style={[styles.name, { color: theme.text }]}>{habit.name}</Text>
                <Text style={[styles.meta, { color: theme.muted }]}>
                  {habit.currentRun} day run
                </Text>
              </View>
              <HoldPillButton
                // Already built today = can't hold again — true only for a
                // BOOLEAN habit that's checked in; COUNT habits can always
                // hold more, so they never show "Built" here.
                built={!canBuild}
                canBuild={canBuild}
                tapToBuild={tapToBuild}
                onBuild={() => onBuild(habit.id)}
                color={habit.color}
                label={habit.name}
                theme={theme}
              />
            </View>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  unmeasuredFallback: { flex: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  handleZone: { height: 44, justifyContent: 'center', alignItems: 'center' },
  handle: { width: 36, height: 4, borderRadius: 2, opacity: 0.4 },
  list: { paddingHorizontal: 20, paddingBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.2)' },
  dot: { width: 14, height: 14, borderRadius: 4, marginRight: 14 },
  labelWrap: { flex: 1 },
  name: { fontFamily: fonts.bold, fontSize: 17 },
  meta: { fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
});
