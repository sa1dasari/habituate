import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { DayGrid } from './LotTile';
import HoldPillButton from './HoldPillButton';
import Toast from './Toast';
import { useToast } from '../hooks/useToast';
import { checkInsInPeriod } from '../utils/lots';
import { toDateKey } from '../utils/date';
import { fonts } from '../theme';

const GRID_WIDTH = 260;
const CELL_PLUS_GAP = 36; // rough per-row height (cell + day-number label + gap) for sizing the card
const CHART_HEIGHT = 160;
const CHART_BAR_GAP = 3;
const CHART_DATE_LABEL_H = 16; // bottom margin reserved for the date axis
const CHART_VALUE_LABEL_H = 16; // top margin reserved for a per-bar count label
const SWIPE_DISTANCE = 40; // horizontal translation (px) needed to count as a page-turn, not a vertical-scroll slip

// A month has up to 31 days, too many to label every one without them
// overlapping — thins them out to roughly one label per ~5 days plus the
// first, last, and today, while a week (<=7 days) just labels every day.
function axisLabelIndices(days) {
  const n = days.length;
  const set = new Set();
  if (n <= 7) {
    for (let i = 0; i < n; i += 1) set.add(i);
    return set;
  }
  const step = Math.ceil(n / 6);
  for (let i = 0; i < n; i += step) set.add(i);
  set.add(n - 1);
  const todayIdx = days.findIndex((d) => d.isToday);
  if (todayIdx >= 0) set.add(todayIdx);
  return set;
}

/** A per-day bar chart for the viewed period, shown above the check-ins
 * list — the day-grid's 0/1/2/3+ color tiers are enough to pick a day, but
 * they flatten anything past 3, so a COUNT habit's "5 reps one day, 1 the
 * next" doesn't read at a glance there. Purely presentational: takes the
 * same `period.days` the grid uses, scaled to this period's own max so the
 * bars are comparable regardless of a weekly vs. monthly target's size. */
function DayCountBarChart({ days, color, width, mutedColor }) {
  if (!days || days.length === 0) return null;
  const max = Math.max(1, ...days.map((d) => d.count));
  const barWidth = (width - CHART_BAR_GAP * (days.length - 1)) / days.length;
  const plotHeight = CHART_HEIGHT - CHART_DATE_LABEL_H - CHART_VALUE_LABEL_H;
  const labelIdx = axisLabelIndices(days);
  return (
    <Svg width={width} height={CHART_HEIGHT}>
      {days.map((day, i) => {
        const barHeight = day.isFuture ? 2 : Math.max(2, (day.count / max) * plotHeight);
        const x = i * (barWidth + CHART_BAR_GAP);
        const y = CHART_VALUE_LABEL_H + (plotHeight - barHeight);
        const cx = x + barWidth / 2;
        return (
          <React.Fragment key={day.dateKey}>
            <Rect
              x={x}
              y={y}
              width={Math.max(1, barWidth)}
              height={barHeight}
              rx={Math.min(2, barWidth / 2)}
              fill={day.isFuture ? mutedColor : color}
              opacity={day.isFuture ? 0.25 : day.count > 0 ? 1 : 0.2}
            />
            {!day.isFuture && day.count > 0 && barWidth >= 14 && (
              <SvgText x={cx} y={y - 4} fontSize={9} fill={mutedColor} textAnchor="middle">
                {day.count}
              </SvgText>
            )}
            {labelIdx.has(i) && (
              <SvgText
                x={cx}
                y={CHART_HEIGHT - 4}
                fontSize={9}
                fill={day.isToday ? color : mutedColor}
                textAnchor="middle"
              >
                {day.dayNum}
              </SvgText>
            )}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

/** A BOOLEAN period's day is just 0 or 1, so the bar chart above would be a
 * barcode of identical full-height bars — restating what the day-grid
 * already shows. What's actually new information there is how the running
 * total climbs toward the period's target, so this draws that instead: a
 * line of the cumulative count-so-far against a dashed target line. */
function CumulativeProgressChart({ days, color, width, target, mutedColor }) {
  if (!days || days.length === 0) return null;
  const plotTop = 12;
  const plotHeight = CHART_HEIGHT - CHART_DATE_LABEL_H - plotTop;
  // Stops at the last real day instead of extending a flat line out
  // through the rest of the period — a flat tail reads as "progress
  // stopped," the perfection-framing the product rules forbid, when it's
  // really just "hasn't happened yet."
  let running = 0;
  const points = [];
  for (let i = 0; i < days.length; i += 1) {
    if (days[i].isFuture) break;
    running += days[i].count;
    points.push({ x: i, cumulative: running });
  }
  if (points.length === 0) return null;
  const maxY = Math.max(target || 0, running, 1);
  const stepX = width / Math.max(1, days.length - 1);
  const toY = (v) => plotTop + plotHeight - (v / maxY) * plotHeight;
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x * stepX},${toY(p.cumulative)}`).join(' ');
  const targetY = target ? toY(target) : null;
  const last = points[points.length - 1];
  const labelIdx = axisLabelIndices(days);
  return (
    <Svg width={width} height={CHART_HEIGHT}>
      {targetY != null && (
        <>
          <Line x1={0} y1={targetY} x2={width} y2={targetY} stroke={mutedColor} strokeDasharray="3,3" strokeWidth={1} opacity={0.6} />
          <SvgText x={width} y={targetY - 4} fontSize={9} fill={mutedColor} textAnchor="end">
            target {target}
          </SvgText>
        </>
      )}
      <Path d={pathD} stroke={color} strokeWidth={2.5} fill="none" />
      <SvgText
        x={Math.min(width - 2, last.x * stepX + 4)}
        y={Math.max(10, toY(last.cumulative) - 6)}
        fontSize={10}
        fill={color}
        textAnchor={last.x * stepX > width - 24 ? 'end' : 'start'}
      >
        {last.cumulative}
      </SvgText>
      {days.map(
        (day, i) =>
          labelIdx.has(i) && (
            <SvgText
              key={day.dateKey}
              x={i * stepX}
              y={CHART_HEIGHT - 4}
              fontSize={9}
              fill={day.isToday ? color : mutedColor}
              textAnchor="middle"
            >
              {day.dayNum}
            </SvgText>
          ),
      )}
    </Svg>
  );
}

/**
 * Phase 2b's lot sheet (SKYLINE.md section 4a gate: "backdate into the last
 * 7 days [...] and delete a wrong entry from a lot's sheet — all without
 * leaving the Skyline tab"). Opens from a `LotTile` tap or a row's "Add for
 * another day" link, pre-focused on that period, with prev/next arrows to
 * move through `row.periods` from there — so backdating isn't limited to
 * whichever period happened to be tapped, only to the habit's own lifetime
 * (`habit.createdAt`; see `minDateKey` below). A plain RN `Modal`
 * (`presentationStyle="pageSheet"`), not the persistent draggable
 * `SkylineHabitSheet` pattern — this is a one-off detail sheet like
 * `InviteFriendsSheet.js`/`NotificationCenterModal.js`, not a panel that
 * stays mounted alongside the scene. Needs its own `GestureHandlerRootView`
 * because the Hold pill's `GestureDetector` can't reach the one wrapping
 * `App.js` from inside a `Modal`'s own native surface (see
 * `NotificationCenterModal.js`'s comment for why).
 *
 * Reuses `LotTile.js`'s `DayGrid` at a bigger size with day numbers shown,
 * rather than reimplementing the per-day cell geometry/coloring here.
 *
 * The caller (`SkylineScreen.js`) must mount this with a `key` derived from
 * the *initially opened* period (habitId + period.key) — that's still
 * needed so a fresh tap on a different tile always starts this component
 * over with clean state, rather than carrying a stale `selectedDateKey`
 * across (a Hold could silently build into the wrong day, or even delete
 * today's check-in on a BOOLEAN habit via the undo-free toggle path).
 * Navigating with the arrows *inside* one mount is handled separately, by
 * an effect that resets the selection whenever `periodIndex` changes.
 */
export default function LotSheet({ visible, onClose, row, period, habit, tapToBuild, theme, onBuildDay, onRemoveCheckIn }) {
  const { toast, showToast, hideToast } = useToast();
  const todayKey = toDateKey(new Date());
  const { width: windowWidth } = useWindowDimensions();
  // Full sheet width minus the scroll's own horizontal padding and the
  // chart card's padding — bigger than the fixed day-grid card, since a
  // chart reads better with more horizontal room for its date axis.
  const chartWidth = Math.max(200, windowWidth - 40 - 28);

  const [periodIndex, setPeriodIndex] = useState(() => {
    const i = row?.periods ? row.periods.findIndex((p) => p.key === period?.key) : -1;
    return i >= 0 ? i : (row?.periods?.length || 1) - 1;
  });
  const viewedPeriod = row?.periods?.[periodIndex] || period;

  // A day before the habit even existed has nothing to backdate into —
  // same "nothing to pick here" treatment DayGrid already gives a future
  // day, just for the other end of the habit's lifetime. Computed before
  // any state that depends on it (default selection, the build guard).
  const minDateKey = habit?.createdAt ? toDateKey(habit.createdAt) : null;
  const isSelectable = (cell) => !cell.isFuture && (!minDateKey || cell.dateKey >= minDateKey);

  const defaultDayKeyFor = (p) => {
    if (!p || !p.days) return todayKey;
    const todayCell = p.days.find((d) => d.isToday);
    if (todayCell) return todayCell.dateKey;
    const firstSelectable = p.days.find(isSelectable);
    return firstSelectable ? firstSelectable.dateKey : p.days[0]?.dateKey || todayKey;
  };
  const [selectedDateKey, setSelectedDateKey] = useState(() => defaultDayKeyFor(viewedPeriod));

  // Navigating to a different period with the arrows keeps this same
  // mount — the selection has to be re-derived for whichever period is now
  // in view instead of pointing at a day that belongs to the old one.
  useEffect(() => {
    setSelectedDateKey(defaultDayKeyFor(viewedPeriod));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodIndex]);

  const countMode = row?.countMode;
  const selectedCell = viewedPeriod?.days?.find((d) => d.dateKey === selectedDateKey);
  // A BOOLEAN day already has a floor built — holding again would toggle it
  // off (undo-free rule), so the pill shows "Built" instead, same guard
  // handleBuild already applies for today's current period. A day before
  // the habit's own creation must never produce a live Hold pill either —
  // same fail-closed rule as an unresolvable selection (shouldn't happen —
  // the effect above and the default-selection guard both keep the
  // selection on a real, in-range day — but this is the one check nothing
  // else should be able to route around).
  const canBuildSelected = selectedCell ? isSelectable(selectedCell) && (countMode || selectedCell.count === 0) : false;
  // Kept above the early return below so this component's hook count never
  // changes between a render with a usable period/row and one without —
  // a background refresh() landing while the sheet is open (the habit got
  // retired, or its target changed, so it drops out of `lots.rows`) must
  // not make `row`/`viewedPeriod` go from defined to undefined between
  // renders and shift which hooks run.
  const entries = useMemo(
    () => (viewedPeriod ? checkInsInPeriod(habit?.checkIns || [], viewedPeriod) : []),
    [habit, viewedPeriod],
  );
  // Grouped by calendar day for the list below — a COUNT habit's day can
  // hold several entries (e.g. 3 gym visits), and a flat list repeated the
  // same date on every one of them instead of showing it once per day.
  // `entries` is already newest-first (checkInsInPeriod sorts it), so
  // building groups via a Map in iteration order keeps both the day groups
  // and each day's own entries newest-first without a second sort.
  const groupedEntries = useMemo(() => {
    const byKey = new Map();
    entries.forEach((entry) => {
      const dateKey = toDateKey(entry.occurredAt);
      if (!byKey.has(dateKey)) {
        byKey.set(dateKey, {
          dateKey,
          label: new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          entries: [],
        });
      }
      byKey.get(dateKey).entries.push(entry);
    });
    return Array.from(byKey.values());
  }, [entries]);

  if (!viewedPeriod || !row) return null;

  // DayGrid centers its rows inside a single square `size` — fine for the
  // compact tile's fixed box, but a 1-row weekly grid in a full 260x260
  // square left most of the card empty (the same "leaves a lot of empty
  // space" complaint the owner raised about the tiles earlier). Size the
  // square to the period's actual row count instead of always maxing it.
  const gridRows = Math.max(1, Math.ceil((viewedPeriod.days?.length || 7) / 7));
  const gridSize = Math.min(GRID_WIDTH, Math.max(100, gridRows * CELL_PLUS_GAP + 40));

  const lastPeriodIdx = (row.periods?.length || 1) - 1;
  const canGoPrev = periodIndex > 0;
  const canGoNext = row.periods && periodIndex < lastPeriodIdx;
  // Clamping inside the updater (rather than branching on `canGoPrev`/
  // `canGoNext` read from this render) means the swipe gesture's `onEnd`
  // worklet — a fresh closure built on every render, never memoized — can't
  // act on a stale bound from whichever render it was captured in.
  const goPrev = () => setPeriodIndex((i) => Math.max(0, i - 1));
  const goNext = () => setPeriodIndex((i) => Math.min(lastPeriodIdx, i + 1));

  // Swipe right (finger moves right) = go back in time, same direction as
  // flipping to a previous page; swipe left = forward to the next period.
  // `activeOffsetX`/`failOffsetY` let a mostly-vertical drag fall through
  // to the ScrollView's own pan responder instead of being stolen here.
  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onEnd((e) => {
      if (e.translationX > SWIPE_DISTANCE) {
        runOnJS(goPrev)();
      } else if (e.translationX < -SWIPE_DISTANCE) {
        runOnJS(goNext)();
      }
    });

  const handleSelectDay = (cell) => {
    if (!isSelectable(cell)) return; // nothing to pick for a day that hasn't happened yet, or predates the habit
    setSelectedDateKey(cell.dateKey);
  };

  const handleBuild = async () => {
    try {
      await onBuildDay(row.habitId, selectedDateKey);
    } catch (err) {
      showToast(`Could not update check-in — ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  const handleRemove = async (checkInId) => {
    try {
      await onRemoveCheckIn(row.habitId, checkInId);
    } catch (err) {
      showToast(`Could not remove check-in — ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  const periodNoun = row.periodKind === 'monthly' ? 'month' : 'week';
  const selectedDayLabel = selectedCell
    ? new Date(`${selectedCell.dateKey}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : selectedDateKey;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn} testID="lot-sheet-close">
              <MaterialCommunityIcons name="close" size={22} color={theme.muted} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
              {row.name}
            </Text>
            <View style={{ width: 34 }} />
          </View>

          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <GestureDetector gesture={swipeGesture}>
              <View>
                <View style={styles.periodNavRow}>
                  <Pressable
                    onPress={goPrev}
                    disabled={!canGoPrev}
                    hitSlop={10}
                    testID="lot-sheet-prev-period"
                    accessibilityRole="button"
                    accessibilityLabel={`Previous ${periodNoun}`}
                    style={styles.periodNavBtn}
                  >
                    <MaterialCommunityIcons name="chevron-left" size={22} color={canGoPrev ? theme.text : theme.muted} />
                  </Pressable>
                  <Text style={[styles.periodLabel, { color: theme.muted }]} numberOfLines={1}>
                    {viewedPeriod.label} · {viewedPeriod.caption}
                  </Text>
                  <Pressable
                    onPress={goNext}
                    disabled={!canGoNext}
                    hitSlop={10}
                    testID="lot-sheet-next-period"
                    accessibilityRole="button"
                    accessibilityLabel={`Next ${periodNoun}`}
                    style={styles.periodNavBtn}
                  >
                    <MaterialCommunityIcons name="chevron-right" size={22} color={canGoNext ? theme.text : theme.muted} />
                  </Pressable>
                </View>

                <View style={[styles.gridCard, { backgroundColor: theme.surfaceHigh }]}>
                  <Svg width={gridSize} height={gridSize} viewBox={`0 0 ${gridSize} ${gridSize}`}>
                    <DayGrid
                      days={viewedPeriod.days}
                      color={row.color}
                      size={gridSize}
                      pad={16}
                      gap={6}
                      dayNumbers
                      textColor={theme.muted}
                      onPressDay={handleSelectDay}
                      selectedDateKey={selectedDateKey}
                      minDateKey={minDateKey}
                    />
                  </Svg>
                </View>

                {!viewedPeriod.shielded && (
                  <View style={[styles.chartCard, { backgroundColor: theme.surfaceHigh }]}>
                    <Text style={[styles.chartTitle, { color: theme.muted }]}>
                      {countMode ? 'CHECK-INS PER DAY' : 'PROGRESS TOWARD TARGET'}
                    </Text>
                    {countMode ? (
                      <DayCountBarChart days={viewedPeriod.days} color={row.color} width={chartWidth} mutedColor={theme.muted} />
                    ) : (
                      <CumulativeProgressChart
                        days={viewedPeriod.days}
                        color={row.color}
                        width={chartWidth}
                        target={row.target}
                        mutedColor={theme.muted}
                      />
                    )}
                  </View>
                )}
              </View>
            </GestureDetector>

            <Text style={[styles.sectionTitle, { color: theme.muted }]}>
              CHECK-INS — {viewedPeriod.label.toUpperCase()}
            </Text>
            {groupedEntries.length === 0 ? (
              <Text style={[styles.emptyEntries, { color: theme.muted }]}>No check-ins logged for {viewedPeriod.label}.</Text>
            ) : (
              groupedEntries.map((group) => (
                <View key={group.dateKey} style={styles.entryGroup}>
                  <Text style={[styles.entryGroupLabel, { color: theme.text }]}>
                    {group.label}
                    {group.entries.length > 1 ? ` · ${group.entries.length}` : ''}
                  </Text>
                  {group.entries.map((entry) => (
                    <View key={entry.id} style={styles.entryRow}>
                      <Text style={[styles.entryText, { color: theme.muted }]}>
                        {new Date(entry.occurredAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </Text>
                      <Pressable onPress={() => handleRemove(entry.id)} hitSlop={8} testID={`lot-sheet-remove-${entry.id}`}>
                        <Text style={[styles.removeText, { color: theme.amber }]}>Remove</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ))
            )}

            <View style={styles.buildRow}>
              <Text style={[styles.buildForLabel, { color: theme.muted }]}>Building for {selectedDayLabel}</Text>
              <HoldPillButton
                built={!canBuildSelected}
                canBuild={canBuildSelected}
                tapToBuild={tapToBuild}
                onBuild={handleBuild}
                color={row.color}
                label={`${row.name}, ${selectedDayLabel}`}
                theme={theme}
              />
            </View>
          </ScrollView>

          <Toast toast={toast} onHide={hideToast} />
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  closeBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.bold, fontSize: 17, flex: 1, textAlign: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  periodNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  periodNavBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  periodLabel: { fontFamily: fonts.semiBold, fontSize: 14, textAlign: 'center', flex: 1 },
  // `stretch` (not `center`-and-shrinkwrap) on both cards so they share the
  // same outer edges stacked on top of each other — the grid centers its
  // own SVG content inside the wider card via `alignItems`, while the
  // chart's SVG fills the width directly (it's meant to read bigger).
  gridCard: { alignSelf: 'stretch', alignItems: 'center', borderRadius: 20, padding: 4, marginBottom: 16 },
  chartCard: { alignSelf: 'stretch', borderRadius: 16, padding: 14, marginBottom: 20 },
  chartTitle: { fontFamily: fonts.semiBold, fontSize: 12, letterSpacing: 0.5, marginBottom: 10 },
  sectionTitle: { fontFamily: fonts.semiBold, fontSize: 12, letterSpacing: 0.5, marginBottom: 8 },
  emptyEntries: { fontFamily: fonts.regular, fontSize: 14, marginBottom: 20 },
  entryGroup: { marginBottom: 6 },
  entryGroupLabel: { fontFamily: fonts.semiBold, fontSize: 14, paddingTop: 10 },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingLeft: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  entryText: { fontFamily: fonts.regular, fontSize: 14 },
  removeText: { fontFamily: fonts.semiBold, fontSize: 14 },
  buildRow: { alignItems: 'center', marginTop: 24 },
  buildForLabel: { fontFamily: fonts.semiBold, fontSize: 13, marginBottom: 10 },
});
