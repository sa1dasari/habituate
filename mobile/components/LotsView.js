import React, { useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import LotTile, { LotLegend } from './LotTile';
import HoldPillButton from './HoldPillButton';
import { fonts } from '../theme';

/**
 * The Weekly/monthly ("lots") view (SKYLINE.md section 4a) — one row per
 * habit: a header (color dot, name, cadence, run), a horizontal strip of
 * lots scrolling back through history (newest on the right, scrolled there
 * by default), and a persistent Hold/Tap pill for the current, in-progress
 * period — not one you have to scroll the strip to find, same as a daily
 * row's pill sits outside the tower art. Reuses `getCanBuild`/`onBuild` from
 * the screen as-is: both already key off `habit.checkedInToday`, which the
 * backend sets from any check-in today regardless of cadence (SKYLINE.md
 * section 4a), so a BOOLEAN weekly/monthly habit is correctly blocked from
 * a second same-day hold and a COUNT one isn't, with no extra plumbing.
 */
export default function LotsView({ rows, habitsById, getCanBuild, onBuild, onOpenSheet, tapToBuild, theme }) {
  return (
    <ScrollView contentContainerStyle={styles.list}>
      {rows.map((row) => (
        <LotRow
          key={row.habitId}
          row={row}
          habit={habitsById[row.habitId]}
          getCanBuild={getCanBuild}
          onBuild={onBuild}
          onOpenSheet={onOpenSheet}
          tapToBuild={tapToBuild}
          theme={theme}
        />
      ))}
      {rows.length === 0 && (
        <Text style={[styles.empty, { color: theme.muted }]}>
          No weekly or monthly habits yet. Lay a foundation with a weekly or monthly target to see it here.
        </Text>
      )}
      {rows.length > 0 && <LotLegend theme={theme} />}
    </ScrollView>
  );
}

const LotRow = React.memo(function LotRow({ row, habit, getCanBuild, onBuild, onOpenSheet, tapToBuild, theme }) {
  const stripRef = useRef(null);
  const canBuild = habit ? getCanBuild(habit.id) : false;
  // `row.periods` can reach back years (the lot sheet's own backdating
  // range) — the horizontal strip only ever shows the recent default
  // window (`row.recentPeriods`, a plain suffix of `periods`), or it would
  // render a tile per period going back that far. The sheet itself still
  // gets the full `row.periods` for its own prev/next navigation.
  const stripPeriods = row.recentPeriods || row.periods;
  const currentPeriod = stripPeriods[stripPeriods.length - 1];
  // One stable callback per period, not a fresh arrow on every render — a
  // memoized LotTile only skips re-rendering if `onPress` is referentially
  // the same across renders, and `row`/`period` are themselves stable
  // (SkylineScreen's `lots` useMemo only rebuilds them when habits/today
  // actually change), so these can genuinely stay put.
  const pressHandlers = useMemo(
    () => stripPeriods.map((period) => () => onOpenSheet?.(row, period)),
    [row, stripPeriods, onOpenSheet],
  );

  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: row.color }]} />
        <View style={styles.headerText}>
          <Text style={[styles.name, { color: theme.text }]}>{row.name}</Text>
          <Text style={[styles.meta, { color: theme.muted }]}>
            {row.cadenceLabel}
            {row.runLabel ? ` · ${row.runLabel}` : ''}
          </Text>
        </View>
      </View>

      <ScrollView
        ref={stripRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
        onContentSizeChange={() => stripRef.current?.scrollToEnd({ animated: false })}
      >
        {stripPeriods.map((period, i) => (
          <LotTile
            key={period.key}
            period={period}
            color={row.color}
            theme={theme}
            onPress={pressHandlers[i]}
          />
        ))}
      </ScrollView>

      <View style={styles.pillRow}>
        <Text style={[styles.pillLabel, { color: theme.muted }]}>
          {row.periodKind === 'monthly' ? 'This month' : 'This week'}
        </Text>
        <HoldPillButton
          built={!canBuild}
          canBuild={canBuild}
          tapToBuild={tapToBuild}
          onBuild={() => onBuild(row.habitId)}
          color={row.color}
          label={row.name}
          theme={theme}
        />
      </View>
      <Pressable
        onPress={() => onOpenSheet?.(row, currentPeriod)}
        hitSlop={8}
        testID={`lot-add-another-day-${row.habitId}`}
        accessibilityRole="button"
        accessibilityLabel={`Add a ${row.name} check-in for another day`}
      >
        <Text style={[styles.addAnotherDay, { color: row.color }]}>Add for another day ›</Text>
      </Pressable>
      <View style={[styles.divider, { backgroundColor: 'rgba(128,128,128,0.2)' }]} accessibilityElementsHidden importantForAccessibility="no" />
    </View>
  );
});

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  row: { marginBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  dot: { width: 14, height: 14, borderRadius: 4, marginRight: 10 },
  headerText: { flex: 1 },
  name: { fontFamily: fonts.bold, fontSize: 17 },
  meta: { fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
  strip: { paddingRight: 8 },
  pillRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  pillLabel: { fontFamily: fonts.semiBold, fontSize: 13 },
  addAnotherDay: { fontFamily: fonts.semiBold, fontSize: 13, marginTop: 10 },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 16 },
  empty: { fontSize: 14, textAlign: 'center', marginTop: 40 },
});
