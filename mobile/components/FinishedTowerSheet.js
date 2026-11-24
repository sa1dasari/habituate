import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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

  const liveHabit = row ? habits.find((h) => h.id === row.habitId) : null;

  const illustration = useMemo(
    () => (row ? finishedTowerIllustration(row.floorCount, resolveHabitColor(row, mode, categoryColors), towerTheme) : null),
    [row, mode, categoryColors, towerTheme],
  );

  const insideSceneHabit = useMemo(() => {
    if (!liveHabit || !row?.startedAt) return null;
    return { ...toSceneHabit(liveHabit, categoryColors, mode), startDate: toDateKey(row.startedAt), currentRun: 0, bestRun: null };
  }, [liveHabit, row, categoryColors, mode]);
  const insideToday = row?.toppedOutAt ? new Date(`${toDateKey(row.toppedOutAt)}T12:00:00`) : null;

  if (!row) return null;

  const bestRun = row.bestRunInSegment || 0;
  const stood = row.startedAt && row.toppedOutAt
    ? Math.max(1, Math.round((new Date(row.toppedOutAt) - new Date(row.startedAt)) / 86400000) + 1)
    : row.floorCount || 0;
  const stats = [
    { key: 'total', value: String(row.floorCount || 0), label: 'Total built' },
    { key: 'best', value: `${bestRun} ${bestRun === 1 ? 'day' : 'days'}`, label: 'Best run here' },
    { key: 'started', value: dateLabel(row.startedAt), label: 'Started' },
  ];

  const shown = isVisibleForHabit(row.habitId);
  const toggleLabel = `${shown ? 'Hide' : 'Show'} finished towers for ${row.habitName}`;

  return (
    <>
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="finished-tower-sheet-backdrop">
        <Pressable style={[styles.sheet, { backgroundColor: theme.surfaceHigh }]} onPress={() => {}} testID="finished-tower-sheet">
          <View style={[styles.handle, { backgroundColor: theme.muted }]} />
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
                {row.habitName}
              </Text>
              <Text style={[styles.meta, { color: theme.muted }]}>
                {`Topped out ${dateLabel(row.toppedOutAt)} · stood ${stood} ${stood === 1 ? 'day' : 'days'}`}
              </Text>
              <View style={[styles.chip, { backgroundColor: theme.background }]}>
                <Text style={[styles.chipText, { color: theme.amber }]}>
                  {row.autoToppedOut ? 'Topped out on its own at the cap' : 'You topped it out'}
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
            accessibilityLabel={`See inside ${row.habitName}`}
          >
            <Text style={styles.seeInsideText}>See inside</Text>
          </Pressable>

          <Pressable
            onPress={() => setHabitOverride(row.habitId, !shown)}
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
      </Pressable>
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
