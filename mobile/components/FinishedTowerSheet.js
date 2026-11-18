import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { categoryIcon } from '../constants/habitCategories';
import { resolveHabitColor } from '../constants/towerColors';
import { fonts } from '../theme';

function dateLabel(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Bottom sheet for one finished tower (board 56): a closed segment of a
 * still-active habit, as opposed to a retired one's monument (MonumentSheet).
 * `row` is a FinishedTowerResponse shape (segmentId, habitId, habitName,
 * category, color, floorCount, bestRunInSegment, startedAt, toppedOutAt,
 * autoToppedOut). Read-only — unlike a retired tower there's nothing to
 * restore here, the habit is already active.
 */
export default function FinishedTowerSheet({ visible, row, onClose, theme, mode, categoryColors }) {
  if (!row) return null;

  const tint = resolveHabitColor(row, mode, categoryColors) || theme.muted;
  const bestRun = row.bestRunInSegment || 0;
  const stats = [
    { key: 'total', value: String(row.floorCount || 0), label: row.floorCount === 1 ? 'Floor built' : 'Floors built' },
    { key: 'best', value: `${bestRun} ${bestRun === 1 ? 'day' : 'days'}`, label: 'Best run' },
    { key: 'started', value: dateLabel(row.startedAt), label: 'Started' },
    { key: 'finished', value: dateLabel(row.toppedOutAt), label: 'Finished' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="finished-tower-sheet-backdrop">
        <Pressable style={[styles.sheet, { backgroundColor: theme.surfaceHigh }]} onPress={() => {}} testID="finished-tower-sheet">
          <View style={[styles.handle, { backgroundColor: theme.muted }]} />
          <Text style={[styles.eyebrow, { color: theme.muted }]}>FINISHED TOWER</Text>

          <View style={styles.hero}>
            <View style={[styles.iconTile, { backgroundColor: tint }]}>
              <MaterialCommunityIcons name={categoryIcon(row.category)} size={26} color="#1A1300" />
            </View>
            <View style={styles.heroText}>
              <Text style={[styles.title, { color: theme.text }]} testID="finished-tower-sheet-title">
                {row.habitName}
              </Text>
              <Text style={[styles.meta, { color: theme.muted }]}>
                {row.autoToppedOut ? 'Topped out on its own at its cap' : 'Topped out'}
              </Text>
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
            {row.habitName} is still an active tower — this is one of its earlier, finished segments.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(4, 7, 18, 0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 18 },
  eyebrow: { fontFamily: fonts.bold, fontSize: 13, letterSpacing: 1.4 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 14, marginBottom: 18 },
  iconTile: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heroText: { flex: 1 },
  title: { fontFamily: fonts.extraBold, fontSize: 24, lineHeight: 30 },
  meta: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, marginTop: 4 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  stat: { flexBasis: '47%', flexGrow: 1, minHeight: 68, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 10 },
  statValue: { fontFamily: fonts.extraBold, fontSize: 20 },
  statLabel: { fontFamily: fonts.regular, fontSize: 14, marginTop: 2 },
  note: { fontFamily: fonts.regular, fontSize: 15, textAlign: 'center', marginTop: 4 },
});
