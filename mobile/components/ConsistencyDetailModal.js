import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { categoryIcon } from '../constants/habitCategories';
import TreeRingChart from './TreeRingChart';
import {
  CONSISTENCY_PERIODS,
  calendarPeriodRangeLabel,
  habitHistorySummary,
  habitPeriodHistory,
  isCurrentCalendarPeriod,
  shiftCalendarAnchor,
} from '../utils/consistency';
import { useAppTheme } from '../hooks/useAppTheme';
import { gradients, radii, shadow, spacing } from '../theme';

const PERIOD_LABELS = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
const LIVE_PERIOD_LABELS = { daily: 'Today', weekly: 'This week', monthly: 'This month', yearly: 'This year' };
const HISTORY_TITLES = {
  daily: 'Today, hour by hour',
  weekly: 'This week, day by day',
  monthly: 'This month, week by week',
  yearly: 'This year, month by month',
};
const HISTORY_SUBTITLES = { daily: 'By hour', weekly: 'By day', monthly: 'By week', yearly: 'By month' };

const BAR_MAX_HEIGHT = 120;

/**
 * Cycled per selected habit so a multi-select chart can tell bars apart —
 * gradient for the fill, solid "to" stop for the legend dot. Broader than
 * theme.js's 3 brand gradients (those carry specific meaning elsewhere —
 * safe/warning/accent) on purpose: this is a categorical chart palette, not
 * a status indicator, so it needs enough distinct hues that a 4th+ selected
 * habit doesn't silently repeat a color already on screen.
 */
const BAR_COLOR_SETS = [
  gradients.safe,
  gradients.accent,
  gradients.warm,
  ['#FB7185', '#E11D48'], // rose
  ['#2DD4BF', '#0D9488'], // teal
  ['#818CF8', '#4338CA'], // indigo
];

/**
 * Samsung-Health-style per-habit drill-down (design/Consistency detail.png),
 * reached by tapping the consistency card on Insights. Presented as a
 * full-page modal (same pattern as CalendarModal) rather than a navigation
 * stack push — this app has no stack navigator wrapping the tab screens.
 *
 * Props:
 *   visible        – boolean
 *   habits         – enriched habit array from useHabits (each has .checkIns[])
 *   initialPeriod  – 'daily' | 'weekly' | 'monthly' | 'yearly', mirrors
 *                    whichever tab was selected on Insights when opened
 *   initialHabitId – optional habit id to pre-select instead of defaulting
 *                    to the first habit — used when opened from a specific
 *                    habit elsewhere in the app (e.g. Profile's habit list)
 *   anchor         – Date the period windows end at; mirrors Insights' own
 *                    prev/next period navigation so this drill-down shows
 *                    the same past period, not always "now"
 *   onClose        – () => void
 */
export default function ConsistencyDetailModal({
  visible,
  habits = [],
  initialPeriod = 'weekly',
  initialHabitId = null,
  anchor: initialAnchor,
  onClose,
}) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);

  const [period, setPeriod] = useState(initialPeriod);
  // Own local anchor, seeded from whatever period Insights was showing when
  // this opened — independent from here on, so prev/next inside this modal
  // doesn't require closing it and moving Insights' own anchor first.
  const [anchor, setAnchor] = useState(() => initialAnchor || new Date());
  // Multi-select: an empty array (on first open) defaults to just the first
  // habit, same single-habit starting point as before — tapping a chip
  // toggles it in/out from there rather than replacing the selection.
  const [selectedHabitIds, setSelectedHabitIds] = useState([]);

  useEffect(() => {
    if (!visible) return;
    setPeriod(initialPeriod);
    setAnchor(initialAnchor || new Date());
    setSelectedHabitIds((current) => {
      if (initialHabitId && habits.some((h) => h.id === initialHabitId)) return [initialHabitId];
      const stillValid = current.filter((id) => habits.some((h) => h.id === id));
      if (stillValid.length > 0) return stillValid;
      return habits[0] ? [habits[0].id] : [];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialPeriod, initialHabitId]);

  const isLivePeriod = isCurrentCalendarPeriod(period, anchor);
  const rangeLabel = calendarPeriodRangeLabel(period, anchor);
  const selectPeriod = (p) => {
    setPeriod(p);
    setAnchor(new Date()); // switching tabs always lands back on the live period, same as Insights
  };
  const goToPreviousPeriod = () => setAnchor((a) => shiftCalendarAnchor(period, a, -1));
  const goToNextPeriod = () => {
    if (isLivePeriod) return;
    setAnchor((a) => shiftCalendarAnchor(period, a, 1));
  };
  const goToNow = () => setAnchor(new Date());

  const toggleHabit = (habitId) => {
    setSelectedHabitIds((current) =>
      current.includes(habitId) ? current.filter((id) => id !== habitId) : [...current, habitId]
    );
  };

  const selectedHabits = habits.filter((h) => selectedHabitIds.includes(h.id));

  // One independent history per selected habit — rendered as a grouped bar
  // per period bucket (one bar per habit, color-coded) rather than blended
  // into a single average, so each habit's own rhythm stays visible when
  // comparing more than one at a time.
  const selectedHistories = useMemo(
    () => selectedHabits.map((habit) => ({ habit, history: habitPeriodHistory(habit, period, anchor || new Date()) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedHabitIds, period, habits, anchor]
  );

  const bucketLabels = selectedHistories[0]?.history.buckets.map((b) => b.label) || [];
  // Daily (hourly) buckets carry a raw logged amount, not a day-count — one busy
  // hour can exceed windowLen=1, so that view scales against its own tallest bar
  // instead of the windowLen-based scaling every other zoom level uses.
  const maxBucketValue =
    selectedHistories.length > 0
      ? period === 'daily'
        ? Math.max(1, ...selectedHistories.flatMap(({ history }) => history.buckets.map((b) => b.value)))
        : Math.max(1, ...selectedHistories.flatMap(({ history }) => history.buckets.map((b) => b.windowLen)))
      : 1;
  const hasAnyWindow = selectedHistories.some(({ history }) => history.buckets.some((b) => b.windowLen > 0));
  // Dense view (hourly's 24, yearly's 12) — thinner bars, own horizontal
  // scroll, no per-bucket value pills (that many would be unreadable
  // clutter squeezed into one screen width with no scroll).
  const isDense = bucketLabels.length >= 12;

  // A "last bucket = status" pill makes sense when the last bucket IS the
  // live period (today's day-bucket, this week's day, etc.) — for hourly,
  // the last bucket is just the 11pm-midnight hour, not "today overall", so
  // skip it there.
  const latestSingleBucket =
    selectedHistories.length === 1 && period !== 'daily'
      ? selectedHistories[0].history.buckets[selectedHistories[0].history.buckets.length - 1]
      : null;

  const subtitleNames = (() => {
    if (selectedHabits.length === 0) return null;
    if (selectedHabits.length === 1) return selectedHabits[0].name;
    if (selectedHabits.length === 2) return `${selectedHabits[0].name} & ${selectedHabits[1].name}`;
    return `${selectedHabits.length} habits`;
  })();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.backBtn}>
            <MaterialCommunityIcons name="chevron-left" size={26} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Consistency detail</Text>
            <Text style={styles.headerSubtitle}>
              {subtitleNames
                ? `${PERIOD_LABELS[period]} rhythm for ${subtitleNames}`
                : habits.length === 0
                  ? 'Add a habit to see its rhythm'
                  : 'Select at least one habit below'}
            </Text>
          </View>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.tabRow}>
            {CONSISTENCY_PERIODS.map((p) => (
              <Pressable
                key={p}
                style={[styles.tabPill, period === p && styles.tabPillActive]}
                onPress={() => selectPeriod(p)}
              >
                <Text style={[styles.tabText, period === p && styles.tabTextActive]}>
                  {PERIOD_LABELS[p]}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.periodNavRow}>
            <Pressable
              onPress={goToPreviousPeriod}
              hitSlop={8}
              style={styles.periodNavBtn}
              accessibilityRole="button"
              accessibilityLabel={`Previous ${period} period`}
            >
              <MaterialCommunityIcons name="chevron-left" size={20} color={colors.textSecondary} />
            </Pressable>

            <Pressable onPress={goToNow} disabled={isLivePeriod} style={styles.periodRangeLabelWrap}>
              <Text style={styles.periodRangeLabel}>{isLivePeriod ? LIVE_PERIOD_LABELS[period] : rangeLabel}</Text>
              {!isLivePeriod ? <Text style={styles.periodRangeSubLabel}>{rangeLabel} · tap for now</Text> : null}
            </Pressable>

            <Pressable
              onPress={goToNextPeriod}
              disabled={isLivePeriod}
              hitSlop={8}
              style={styles.periodNavBtn}
              accessibilityRole="button"
              accessibilityLabel={`Next ${period} period`}
            >
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={isLivePeriod ? colors.textMuted : colors.textSecondary}
              />
            </Pressable>
          </View>

          {habits.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.emptyText}>
                No habits yet — create one to start building a consistency history.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>Selected habits</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>
                      {selectedHabits.length} of {habits.length} selected
                    </Text>
                  </View>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  {habits.map((habit) => {
                    const selected = selectedHabitIds.includes(habit.id);
                    return (
                      <Pressable
                        key={habit.id}
                        style={[styles.chip, selected && styles.chipSelected]}
                        onPress={() => toggleHabit(habit.id)}
                      >
                        <MaterialCommunityIcons
                          name={categoryIcon(habit.category)}
                          size={20}
                          color={selected ? colors.safe : colors.textSecondary}
                        />
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>
                          {habit.name}
                        </Text>
                        {selected ? (
                          <MaterialCommunityIcons name="check" size={14} color={colors.safe} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {selectedHabits.length === 0 ? (
                <View style={styles.card}>
                  <Text style={styles.emptyText}>Select at least one habit above to see its consistency.</Text>
                </View>
              ) : (
                <>
                  <View style={styles.card}>
                    <View style={styles.cardHeaderRow}>
                      <View>
                        <Text style={styles.cardTitle}>{HISTORY_TITLES[period]}</Text>
                        <Text style={styles.cardSubtitle}>{HISTORY_SUBTITLES[period]}</Text>
                      </View>
                      {latestSingleBucket && latestSingleBucket.value > 0 ? (
                        <View style={styles.statusPill}>
                          <View style={styles.statusDot} />
                          <Text style={styles.statusText}>
                            {latestSingleBucket.windowLen > 0 && latestSingleBucket.value >= latestSingleBucket.windowLen
                              ? 'Completed'
                              : 'In progress'}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {hasAnyWindow ? (
                      selectedHistories.length === 1 ? (() => {
                        // No per-bar value row here by design — matches the hourly
                        // (daily) view's clean look, which has none either; the
                        // "Selected-period details" card below already gives the
                        // actual numbers in readable text, so a number squeezed
                        // under every single bar was pure duplication and, at 7+
                        // columns, visual clutter with little room to breathe.
                        const bars = (
                          <View style={[styles.chartRow, isDense && styles.chartRowDense]}>
                            {bucketLabels.map((label, bucketIndex) => {
                              const bucket = selectedHistories[0].history.buckets[bucketIndex];
                              const pct = maxBucketValue > 0 ? Math.round((bucket.value / maxBucketValue) * 100) : 0;
                              const colorSet = BAR_COLOR_SETS[0];
                              return (
                                <View
                                  key={bucketIndex}
                                  style={[styles.barColumn, isDense && styles.barColumnDense]}
                                  accessibilityLabel={`${label || bucketIndex}: ${bucket.value} day${bucket.value === 1 ? '' : 's'}`}
                                >
                                  <View style={styles.barGroup}>
                                    <View style={[styles.barTrack, isDense && styles.barTrackDense]}>
                                      {bucket.value > 0 ? (
                                        <LinearGradient
                                          colors={colorSet}
                                          start={{ x: 0, y: 0 }}
                                          end={{ x: 0, y: 1 }}
                                          style={[styles.barFill, { height: `${Math.max(pct, 6)}%` }]}
                                        />
                                      ) : null}
                                    </View>
                                  </View>
                                  <Text style={styles.barAxisLabel}>{label}</Text>
                                </View>
                              );
                            })}
                          </View>
                        );
                        // Dense (hourly/yearly) genuinely scrolls, so it needs the
                        // ScrollView for real content width. Non-dense (weekly/
                        // monthly) must NOT be wrapped in one: a horizontal
                        // ScrollView sizes its content to the children's natural
                        // width rather than the screen width, so barColumn's
                        // flex:1 has nothing to expand against and every bar
                        // packs to its bare 28px with no gap between them —
                        // scrollEnabled={false} alone doesn't fix that sizing.
                        return isDense ? (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {bars}
                          </ScrollView>
                        ) : (
                          bars
                        );
                      })() : (
                        <>
                          <TreeRingChart
                            selectedHistories={selectedHistories}
                            colorSets={BAR_COLOR_SETS}
                            trackColor={colors.ringTrack}
                            labelColor={colors.textMuted}
                            size={272}
                          />

                          <Text style={styles.ringHint}>Tap a habit below to see its own history</Text>

                          <View style={styles.legendRow}>
                            {selectedHistories.map(({ habit }, i) => (
                              <Pressable
                                key={habit.id}
                                style={styles.legendItem}
                                accessibilityRole="button"
                                accessibilityLabel={`View ${habit.name} alone`}
                                onPress={() => setSelectedHabitIds([habit.id])}
                              >
                                <View
                                  style={[
                                    styles.legendDot,
                                    { backgroundColor: BAR_COLOR_SETS[i % BAR_COLOR_SETS.length][1] },
                                  ]}
                                />
                                <Text style={styles.legendText} numberOfLines={1}>
                                  {habit.name}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        </>
                      )
                    ) : (
                      <Text style={styles.emptyText}>No history yet in this window.</Text>
                    )}
                  </View>

                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Selected-period details</Text>
                    {selectedHistories.map(({ habit, history: h }, i) => (
                      <View key={habit.id} style={i > 0 ? styles.summaryBlock : null}>
                        {selectedHistories.length > 1 ? (
                          <Text style={styles.summaryHabitName}>{habit.name}</Text>
                        ) : null}
                        <Text style={styles.summaryText}>{habitHistorySummary(h)}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function makeStyles(colors, typography) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: { flex: 1, alignItems: 'center' },
    headerTitle: { ...typography.sectionTitle },
    headerSubtitle: { ...typography.meta, marginTop: 2, textAlign: 'center' },
    scroll: { padding: spacing.xl, paddingBottom: spacing.xxl },
    tabRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: radii.pill,
      padding: 4,
      marginBottom: spacing.lg,
    },
    tabPill: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      alignItems: 'center',
    },
    tabPillActive: { backgroundColor: colors.textPrimary },
    tabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    tabTextActive: { color: colors.background },
    periodNavRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    periodNavBtn: {
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
    },
    periodRangeLabelWrap: { alignItems: 'center', minWidth: 140 },
    periodRangeLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
    periodRangeSubLabel: { ...typography.meta, marginTop: 1 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      ...shadow,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.md,
    },
    cardTitle: { ...typography.cardTitle },
    cardSubtitle: { ...typography.meta, marginTop: 2 },
    countBadge: {
      backgroundColor: colors.neutralSoft,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 4,
    },
    countBadgeText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
    chipRow: { gap: spacing.sm },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.sm,
      maxWidth: 160,
    },
    chipSelected: {
      backgroundColor: colors.safeSoft,
      borderColor: colors.safe,
    },
    chipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    chipTextSelected: { color: colors.textPrimary, fontWeight: '700' },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.safeSoft,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 4,
    },
    statusDot: { width: 6, height: 6, borderRadius: radii.pill, backgroundColor: colors.safe },
    statusText: { fontSize: 12, fontWeight: '700', color: colors.safe },
    chartRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'flex-end',
      marginTop: spacing.md,
    },
    barColumn: { alignItems: 'center', flex: 1 },
    // Dense (hourly, 24 bars) scrolls horizontally instead of squeezing every
    // bar into one screen width — fixed-width columns so ScrollView has a
    // real content width to scroll, narrower bars to fit more per screen.
    chartRowDense: { justifyContent: 'flex-start', paddingHorizontal: spacing.xs },
    barColumnDense: { flex: 0, width: 30 },
    barTrackDense: { width: 14 },
    barGroup: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
    barTrack: {
      width: 28,
      height: BAR_MAX_HEIGHT,
      justifyContent: 'flex-end',
      backgroundColor: colors.ringTrack,
      borderRadius: radii.sm,
      overflow: 'hidden',
    },
    barFill: { width: '100%', borderRadius: radii.sm },
    ringHint: { ...typography.meta, textAlign: 'center', marginTop: spacing.sm },
    barAxisLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, marginTop: spacing.sm },
    legendRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      marginTop: spacing.md,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: 140 },
    legendDot: { width: 8, height: 8, borderRadius: radii.pill },
    legendText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    summaryText: { ...typography.body, color: colors.textSecondary, lineHeight: 20 },
    summaryBlock: { marginTop: spacing.md },
    summaryHabitName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  });
}
