import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import SkylineTower from './SkylineTower';
import TowerInsideView from './TowerInsideView';
import ShareSheet from './ShareSheet';
import { useHabits } from '../hooks/useHabits';
import { useShowFinishedTowers } from '../hooks/useShowFinishedTowers';
import { resolveHabitColor } from '../constants/towerColors';
import { toSceneHabit } from '../utils/skylineAdapter';
import { finishedTowerIllustration, DX } from '../utils/skylineScene';
import { toDateKey } from '../utils/date';
import { fonts } from '../theme';

const DISMISS_DISTANCE = 100; // drag-down distance that counts as "let go of the sheet" (TowerSheet.js uses the same idea)

function dateLabel(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Bottom sheet for one finished tower (board 56): a closed segment of a
 * still-active habit, as opposed to a retired one's monument (MonumentSheet).
 * `row` is a FinishedTowerResponse shape (segmentId, habitId, habitName,
 * category, color, floorCount, bestRunInSegment, startedAt, toppedOutAt,
 * autoToppedOut). Opens only from the Retired and finished list (board 58) —
 * a faded tower on the live skyline is not itself tappable (owner decision
 * 2026-11-18, `skylineScene.js`'s closedSegmentShapes never adds a hit
 * target), so this is the one entry point.
 */
export default function FinishedTowerSheet({ visible, row, onClose, theme, towerTheme, mode, categoryColors, onAskAboutTower, onAskAboutDay }) {
  const { habits } = useHabits();
  const { isVisibleForHabit, setHabitOverride } = useShowFinishedTowers();
  const [insideVisible, setInsideVisible] = useState(false);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);

  // Kept around through the close animation (same reason as TowerSheet.js's
  // `lastHabit`): the caller nulls `row` the instant onClose fires, and this
  // sheet needs its content to keep rendering while the drag/slide-down
  // animation plays rather than popping blank mid-exit.
  const [lastRow, setLastRow] = useState(null);
  useEffect(() => {
    if (row) setLastRow(row);
  }, [row]);
  const displayRow = row || lastRow;

  const translateY = useSharedValue(0);
  useEffect(() => {
    if (visible) translateY.value = 0;
  }, [visible, translateY]);
  const dismiss = () => onClose();
  const dragGesture = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate((event) => {
          translateY.value = Math.max(0, event.translationY);
        })
        .onEnd((event) => {
          if (event.translationY > DISMISS_DISTANCE || event.velocityY > 800) {
            // Snap back to 0 immediately and let the Modal's own "slide"
            // animationType play the actual exit, rather than stacking a
            // second animation on top of it.
            translateY.value = 0;
            runOnJS(dismiss)();
          } else {
            translateY.value = withSpring(0, { damping: 50, stiffness: 400 });
          }
        }),
    [],
  );
  const dragAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  const liveHabit = displayRow ? habits.find((h) => h.id === displayRow.habitId) : null;

  const illustration = useMemo(
    () => (displayRow ? finishedTowerIllustration(displayRow.floorCount, resolveHabitColor(displayRow, mode, categoryColors), towerTheme) : null),
    [displayRow, mode, categoryColors, towerTheme],
  );

  const insideSceneHabit = useMemo(() => {
    if (!liveHabit || !displayRow?.startedAt) return null;
    return { ...toSceneHabit(liveHabit, categoryColors, mode), startDate: toDateKey(displayRow.startedAt), currentRun: 0, bestRun: null };
  }, [liveHabit, displayRow, categoryColors, mode]);
  const insideToday = displayRow?.toppedOutAt ? new Date(`${toDateKey(displayRow.toppedOutAt)}T12:00:00`) : null;

  if (!displayRow) return null;

  const bestRun = displayRow.bestRunInSegment || 0;
  const stood = displayRow.startedAt && displayRow.toppedOutAt
    ? Math.max(1, Math.round((new Date(displayRow.toppedOutAt) - new Date(displayRow.startedAt)) / 86400000) + 1)
    : displayRow.floorCount || 0;
  const stats = [
    { key: 'total', value: String(displayRow.floorCount || 0), label: 'Total built' },
    { key: 'best', value: `${bestRun} ${bestRun === 1 ? 'day' : 'days'}`, label: 'Best run here' },
    { key: 'started', value: dateLabel(displayRow.startedAt), label: 'Started' },
  ];

  const shown = isVisibleForHabit(displayRow.habitId);
  const toggleLabel = `${shown ? 'Hide' : 'Show'} finished towers for ${displayRow.habitName}`;

  return (
    <>
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* The handle's GestureDetector needs its own root — the one wrapping
          App.js can't reach into a Modal's separate native surface (same
          reason LotSheet.js nests one; see its comment). */}
      <GestureHandlerRootView style={{ flex: 1 }}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="finished-tower-sheet-backdrop">
        <Animated.View style={[styles.sheet, { backgroundColor: theme.surfaceHigh }, dragAnimatedStyle]}>
        <Pressable onPress={() => {}} testID="finished-tower-sheet">
          <GestureDetector gesture={dragGesture}>
            <View style={styles.handleZone} testID="finished-tower-sheet-handle">
              <View style={[styles.handle, { backgroundColor: theme.muted }]} />
            </View>
          </GestureDetector>
          <View style={styles.eyebrowRow}>
            <Text style={[styles.eyebrow, { color: theme.muted }]}>FINISHED TOWER</Text>
            <Pressable
              onPress={() => setShareSheetVisible(true)}
              hitSlop={10}
              style={styles.shareIconBtn}
              accessibilityRole="button"
              accessibilityLabel="Share tower"
              testID="finished-tower-sheet-share"
            >
              <MaterialCommunityIcons name="share-variant-outline" size={20} color={theme.muted} />
            </Pressable>
          </View>

          <View style={styles.hero}>
            {illustration && (
              <Svg width={illustration.width} height={illustration.height} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <SkylineTower shapes={illustration.shapes} />
              </Svg>
            )}
            <View style={styles.heroText}>
              <Text style={[styles.title, { color: theme.text }]} testID="finished-tower-sheet-title">
                {displayRow.habitName}
              </Text>
              <Text style={[styles.meta, { color: theme.muted }]}>
                {`Topped out ${dateLabel(displayRow.toppedOutAt)} · stood ${stood} ${stood === 1 ? 'day' : 'days'}`}
              </Text>
              <View style={[styles.chip, { backgroundColor: theme.background }]}>
                <Text style={[styles.chipText, { color: theme.amber }]}>
                  {displayRow.autoToppedOut ? 'Topped out on its own at the cap' : 'You topped it out'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.stats}>
            {stats.map((s) => (
              <View
                key={s.key}
                style={[styles.stat, { backgroundColor: theme.surfaceLow }]}
                testID={`finished-tower-stat-${s.key}`}
                accessible
                accessibilityLabel={`${s.label}: ${s.value}`}
              >
                <Text style={[styles.statValue, { color: theme.text }]} numberOfLines={1}>
                  {s.value}
                </Text>
                <Text style={[styles.statLabel, { color: theme.muted }]}>{s.label}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.note, { color: theme.muted }]}>
            This tower stays on your skyline behind the new one. Your run carried over to the new tower.
          </Text>

          <Pressable
            onPress={() => setInsideVisible(true)}
            disabled={!insideSceneHabit}
            style={[styles.seeInside, { backgroundColor: theme.amber, opacity: insideSceneHabit ? 1 : 0.5 }]}
            testID="finished-tower-see-inside"
            accessibilityRole="button"
            accessibilityLabel={`See inside ${displayRow.habitName}`}
          >
            <Text style={styles.seeInsideText}>See inside</Text>
          </Pressable>

          <Pressable
            onPress={() => setHabitOverride(displayRow.habitId, !shown)}
            style={styles.linkRow}
            testID="finished-tower-toggle-habit"
            accessibilityRole="button"
            accessibilityLabel={toggleLabel}
          >
            <Text style={[styles.link, { color: theme.text }]}>{toggleLabel}</Text>
          </Pressable>

          <Pressable onPress={onClose} style={styles.linkRow} testID="finished-tower-sheet-close" accessibilityRole="button" accessibilityLabel="Close">
            <Text style={[styles.link, { color: theme.muted }]}>Close</Text>
          </Pressable>
        </Pressable>
        </Animated.View>
      </Pressable>
      </GestureHandlerRootView>
    </Modal>
    {insideSceneHabit && (
      <TowerInsideView
        visible={insideVisible}
        onClose={() => setInsideVisible(false)}
        habit={liveHabit}
        sceneHabit={insideSceneHabit}
        today={insideToday}
        uiTheme={theme}
        towerTheme={towerTheme}
        tapToBuild={false}
        onAskAboutTower={onAskAboutTower}
        onAskAboutDay={onAskAboutDay}
      />
    )}
    <ShareSheet visible={shareSheetVisible} onClose={() => setShareSheetVisible(false)} habit={null} row={row} />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(4, 7, 18, 0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
  handleZone: { alignItems: 'center', paddingVertical: 10 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 18 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shareIconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  eyebrow: { fontFamily: fonts.bold, fontSize: 13, letterSpacing: 1.4 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 14, marginBottom: 18 },
  heroText: { flex: 1 },
  title: { fontFamily: fonts.extraBold, fontSize: 24, lineHeight: 30 },
  meta: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, marginTop: 4 },
  chip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginTop: 10 },
  chipText: { fontFamily: fonts.bold, fontSize: 13 },
  stats: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  stat: { flex: 1, minHeight: 68, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 10 },
  statValue: { fontFamily: fonts.extraBold, fontSize: 20 },
  statLabel: { fontFamily: fonts.regular, fontSize: 14, marginTop: 2 },
  note: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, marginBottom: 20 },
  seeInside: { minHeight: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  seeInsideText: { fontFamily: fonts.bold, fontSize: 18, color: '#1A1300' },
  linkRow: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  link: { fontFamily: fonts.semiBold, fontSize: 15 },
});
