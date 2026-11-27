import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import HoldPillButton from './HoldPillButton';
import { useTabBarOverlayInset } from '../hooks/useFloatingTabBar';
import { fonts } from '../theme';

export const SHEET_PEEK_HEIGHT_BASE = 170;
const EXPANDED_RATIO = 0.6; // how much of the stage the sheet covers when pulled up

/**
 * The actual peek height to use — base + however much room the floating tab
 * bar's overlay needs (0 when docked), board 101: "on the Skyline tab the
 * sheet peek height grows by the same amount, so the sheet never rests
 * under the bar." SkylineScreen.js calls this too (its scene height and
 * tour-target marker both key off the same number) so the two can't drift.
 */
export function useSheetPeekHeight() {
  return SHEET_PEEK_HEIGHT_BASE + useTabBarOverlayInset();
}

/**
 * The persistent bottom sheet list below the skyline scene
 * (design/skyline/01-skyline.png). A draggable card, not a sheet
 * locked to the bottom of the screen: collapsed it peeks a couple of rows
 * above the screen edge; dragging the handle up to roughly the middle of
 * the stage lets it scroll the full habit list on top of the skyline, same
 * as a native bottom sheet. `stageHeight` comes from the screen's own
 * onLayout (no hardcoded device height — CLAUDE.md section 7). Also the
 * full non-visual equivalent of the skyline for a screen reader (section
 * 13): every tower's name, run length, and build action are plain rows
 * here, not just shapes.
 */
export default function SkylineHabitSheet({ habits, getCanBuild, onBuild, onOpenSheet, tapToBuild, theme, stageHeight }) {
  const peekHeight = useSheetPeekHeight();
  const overlayInset = useTabBarOverlayInset();
  const measured = stageHeight > 0;
  const collapsedY = measured ? Math.max(0, stageHeight - peekHeight) : 0;
  // Pulling up `overlayInset` further than the plain 60% ratio when the
  // floating bar is on — not just padding the scrollable content — matters
  // because EXPANDED_RATIO caps how tall the revealed, scrollable window
  // itself can ever be: padding alone adds more to scroll *through*, but if
  // the window has no slack bigger than that padding, the last row can
  // still never clear the bar's band at the window's own bottom edge. Both
  // together (this, plus the content's own bottom padding below) make sure
  // there's real room to scroll the last row clear, not just more content
  // stacked in a window too short to ever reveal it.
  const expandedY = measured ? Math.max(0, stageHeight - stageHeight * EXPANDED_RATIO - overlayInset) : 0;

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
      <ScrollView
        style={styles.scrollFlex}
        contentContainerStyle={[styles.list, { paddingBottom: 24 + overlayInset }]}
      >
        {habits.map((habit) => {
          const canBuild = getCanBuild(habit.id);
          return (
            <View key={habit.id} style={styles.row}>
              <Pressable
                style={styles.rowPress}
                onPress={() => onOpenSheet?.(habit.id)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${habit.name}'s tower details`}
                testID={`skyline-sheet-row-${habit.id}`}
              >
                <View style={[styles.dot, { backgroundColor: habit.color }]} />
                <View style={styles.labelWrap}>
                  <Text style={[styles.name, { color: theme.text }]}>{habit.name}</Text>
                  <Text style={[styles.meta, { color: theme.muted }]}>
                    {habit.currentRun > 0 ? `${habit.currentRun}-day run` : 'No run yet'}
                  </Text>
                </View>
              </Pressable>
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
    // Without this, the ScrollView's content could render past this
    // View's own bounds when expanded (the list taller than the revealed
    // area) rather than scrolling internally — the overflow didn't get
    // clipped, it just carried on past the sheet and under the tab bar,
    // reading as the last rows being cropped off by the tab bar itself.
    overflow: 'hidden',
  },
  unmeasuredFallback: { flex: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  handleZone: { height: 44, justifyContent: 'center', alignItems: 'center' },
  handle: { width: 36, height: 4, borderRadius: 2, opacity: 0.4 },
  // flex:1 so the ScrollView itself is bounded by the sheet's fixed height
  // (contentContainerStyle alone only sizes the content, not the scroller).
  scrollFlex: { flex: 1 },
  list: { paddingHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.2)' },
  // Tapping the dot/name/run opens the tower sheet, same as tapping the
  // tower itself — the Hold/Built pill stays a separate sibling (not
  // nested inside this Pressable) so its own hold gesture never has to
  // compete with this row's simple tap.
  rowPress: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  dot: { width: 14, height: 14, borderRadius: 4, marginRight: 14 },
  labelWrap: { flex: 1 },
  name: { fontFamily: fonts.bold, fontSize: 17 },
  meta: { fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
});
