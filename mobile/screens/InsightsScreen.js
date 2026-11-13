import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import CalendarModal from '../components/CalendarModal';
import TourHighlight from '../components/TourHighlight';
import Toast from '../components/Toast';
import { categoryColor, categoryIcon, HABIT_CATEGORY_COLORS } from '../constants/habitCategories';
import { useAppTheme } from '../hooks/useAppTheme';
import { useHabits } from '../hooks/useHabits';
import { useToast } from '../hooks/useToast';
import { useRegisterScrollToTop } from '../hooks/useRegisterScrollToTop';
import { useTourTarget } from '../hooks/useTourTarget';
import { TOUR_SCOPES, TOUR_TARGETS } from '../constants/onboardingTour';
import {
  CONSISTENCY_PERIODS,
  habitHistorySummary,
  habitPeriodHistory,
  isCurrentPeriod,
  periodRangeLabel,
  shiftAnchor,
  totalFloorsHistory,
} from '../utils/consistency';
import { buildCategoryTowerColors, fonts, gradients, radii, shadow, spacing } from '../theme';

/**
 * Cycled per selected habit so a multi-select chart can tell bars apart —
 * same palette ConsistencyDetailModal used before this screen absorbed it.
 */
const BAR_COLOR_SETS = [
  gradients.safe,
  gradients.accent,
  gradients.warm,
  ['#FB7185', '#E11D48'], // rose
  ['#2DD4BF', '#0D9488'], // teal
  ['#818CF8', '#4338CA'], // indigo
];

// Per-habit color for the new Floors/Runs/Shield-use cards — the raw habit
// record (unlike the Skyline scene/lot builders' transformed shape) has no
// .color of its own; same derivation TodayScreen.js/TowerSheet.js use.
const towerColorsByMode = buildCategoryTowerColors(HABIT_CATEGORY_COLORS);

const BAR_MAX_HEIGHT = 120;
const HISTORY_TITLES = {
  weekly: 'This week, day by day',
  monthly: 'This month, week by week',
  yearly: 'This year, month by month',
};
const HISTORY_SUBTITLES = { weekly: 'By day', monthly: 'By week', yearly: 'By month' };
// Phase 5 (design/skyline/06-insights.png): Week/Month/Year only — the old
// Daily tab (24-hourly-bar view) is dropped, owner decision 2026-11-13.
// CONSISTENCY_PERIODS itself still includes 'daily' (computeConsistency/
// habitPeriodHistory's hourly branch stays correct and is still used by
// ProfileScreen.js's weekly-consistency stat), just not offered as a tab
// here anymore.
const PERIOD_ORDER = CONSISTENCY_PERIODS.filter((p) => p !== 'daily');

// Tab labels match the Runs/Shield-use follow-up mockup exactly ("8 weeks" /
// "6 months" / "Year") — a rolling bucket-count framing, not calendar-period
// names, superseding 06-insights.png's plain "Week/Month/Year" labels.
const PERIOD_LABELS = { weekly: '8 weeks', monthly: '6 months', yearly: 'Year' };
const LIVE_PERIOD_LABELS = { weekly: 'This week', monthly: 'This month', yearly: 'This year' };

/**
 * Pattern/correlation detection (Phase 5/6) was removed 2026-10-04 — real
 * usage showed it wasn't useful. This screen is now the "Floors laid"
 * summary (Phase 5 rebuild, design/skyline/06-insights.png — replaces the
 * old consistency-ring card, TreeRingChart.js no longer used here) plus the
 * per-habit bar-graph breakdown (formerly a separate drill-down modal,
 * ConsistencyDetailModal, inlined directly into this page so the detail is
 * visible without an extra tap). computeConsistency/consistencyMessage
 * stay in utils/consistency.js (ProfileScreen.js's weekly-consistency stat
 * still uses them) but this screen no longer does. Ask Habituate's entry
 * point lives on TodayScreen now (chat icon, top-right header) rather than
 * here — SKILLS.md Phase 10's original placement for its full replacement
 * of pattern detection. The mockup's "Compare" card (pick two habits, see
 * a non-causal co-occurrence stat) is a separate, not-yet-built addition —
 * genuinely new capability, not a rewire of anything removed, so it's
 * deliberately out of this pass (see SKYLINE.md section 14).
 */
export default function InsightsScreen({ navigation, route }) {
  const { colors, typography, effectiveMode } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const insets = useSafeAreaInsets();
  const scrollRef = useRegisterScrollToTop('Insights');
  const habitCategoryColors = towerColorsByMode[effectiveMode];
  const habitColor = useCallback(
    (habit) => (habitCategoryColors && habitCategoryColors[habit.category]) || categoryColor(habit.category),
    [habitCategoryColors]
  );

  const { habits, refresh, toggleCheckIn, busy } = useHabits();
  const { toast, showToast, hideToast } = useToast();
  const [period, setPeriod] = useState('weekly');
  // The date each period's trailing window ends at — "now" shows the live
  // period; prev/next slide it back/forward a whole window-length at a time
  // (see utils/consistency.js's shiftAnchor), which is what lets this one
  // state value drive weekly/monthly/yearly navigation without a new
  // backend endpoint — computeConsistency/habitPeriodHistory already derive
  // every stat from the full check-in history already loaded client-side.
  const [anchor, setAnchor] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  // Multi-select: an empty array defaults to just the first habit — tapping
  // a chip toggles it in/out from there, same as the old detail drill-down.
  const [selectedHabitIds, setSelectedHabitIds] = useState([]);
  // Tapping a week/month/year bar opens the real calendar at that bucket's
  // date, reusing its existing day-detail panel.
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarAnchorDateKey, setCalendarAnchorDateKey] = useState(null);
  const [calendarSelectedDayKey, setCalendarSelectedDayKey] = useState(null);

  // Was HabitsScreen.js's handleToggleCalendarDay — backdates/undoes a BOOLEAN
  // habit's check-in for the tapped day. HabitsScreen was the only screen
  // wiring this into CalendarModal's onToggleHabitDay; restoring it here so
  // removing that screen doesn't silently drop the capability.
  const handleToggleCalendarDay = useCallback(
    async (habit, dayKey) => {
      try {
        await toggleCheckIn(habit.id, dayKey);
      } catch (err) {
        showToast(`Could not update check-in — ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      }
    },
    [toggleCheckIn, showToast]
  );

  useEffect(() => {
    setSelectedHabitIds((current) => {
      const stillValid = current.filter((id) => habits.some((h) => h.id === id));
      if (stillValid.length > 0) return stillValid;
      return habits[0] ? [habits[0].id] : [];
    });
  }, [habits]);

  const toggleHabit = (habitId) => {
    setSelectedHabitIds((current) =>
      current.includes(habitId) ? current.filter((id) => id !== habitId) : [...current, habitId]
    );
  };

  const openBucketInCalendar = (bucketPeriod, bucket) => {
    if (!bucket.dateKey) return;
    setCalendarAnchorDateKey(bucket.dateKey);
    setCalendarSelectedDayKey(bucketPeriod === 'yearly' ? null : bucket.dateKey);
    setCalendarVisible(true);
  };

  const tourFloorsCardRef = useTourTarget(TOUR_TARGETS.INSIGHTS_CONSISTENCY_CARD);

  const floors = useMemo(() => totalFloorsHistory(habits, period, anchor), [habits, period, anchor]);
  const maxFloorsBucketValue = Math.max(1, ...floors.buckets.map((b) => b.value));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const isLivePeriod = isCurrentPeriod(period, anchor);
  const rangeLabel = periodRangeLabel(period, anchor);
  // Yearly (12 monthly bars) gets its own horizontal ScrollView below (see
  // isDense usage further down) — the swipe-to-navigate-period pan gesture
  // is disabled there so a finger drag over the bars scrolls them instead
  // of fighting the period swipe.
  const isDense = period === 'yearly';

  const selectPeriod = (p) => {
    setPeriod(p);
    setAnchor(new Date()); // switching tabs always lands back on the live period
  };
  const goToPreviousPeriod = useCallback(() => setAnchor((a) => shiftAnchor(period, a, -1)), [period]);
  const goToNextPeriod = useCallback(() => {
    setAnchor((a) => (isCurrentPeriod(period, a) ? a : shiftAnchor(period, a, 1)));
  }, [period]);
  const goToNow = () => setAnchor(new Date());

  // Pinch-out = zoom into finer detail (yearly -> monthly -> weekly -> daily),
  // pinch-in = zoom out to a broader range — same metaphor as a map or photo
  // gallery. Swipe left/right moves one period at a time, same step as the
  // prev/next chevrons. Both gestures land back on the live period on a
  // granularity change, same as tapping a period tab directly.
  const zoomToFinerPeriod = useCallback(() => {
    setPeriod((p) => {
      const idx = PERIOD_ORDER.indexOf(p);
      return PERIOD_ORDER[Math.max(idx - 1, 0)];
    });
    setAnchor(new Date());
  }, []);
  const zoomToBroaderPeriod = useCallback(() => {
    setPeriod((p) => {
      const idx = PERIOD_ORDER.indexOf(p);
      return PERIOD_ORDER[Math.min(idx + 1, PERIOD_ORDER.length - 1)];
    });
    setAnchor(new Date());
  }, []);

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch().onEnd((e) => {
        'worklet';
        if (e.scale > 1.25) runOnJS(zoomToFinerPeriod)();
        else if (e.scale < 0.8) runOnJS(zoomToBroaderPeriod)();
      }),
    [zoomToFinerPeriod, zoomToBroaderPeriod]
  );
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!isDense)
        .activeOffsetX([-16, 16])
        .failOffsetY([-12, 12])
        .onEnd((e) => {
          'worklet';
          if (e.translationX < -40) runOnJS(goToNextPeriod)();
          else if (e.translationX > 40) runOnJS(goToPreviousPeriod)();
        }),
    [goToNextPeriod, goToPreviousPeriod, isDense]
  );
  const chartGesture = useMemo(() => Gesture.Simultaneous(pinchGesture, panGesture), [pinchGesture, panGesture]);

  const selectedHabits = habits.filter((h) => selectedHabitIds.includes(h.id));
  const selectedHistories = useMemo(
    () => selectedHabits.map((habit) => ({ habit, history: habitPeriodHistory(habit, period, anchor || new Date()) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedHabitIds, period, habits, anchor]
  );
  const maxBucketValue =
    selectedHistories.length > 0
      ? Math.max(1, ...selectedHistories.flatMap(({ history }) => history.buckets.map((b) => b.windowLen)))
      : 1;
  const hasAnyWindow = selectedHistories.some(({ history }) => history.buckets.some((b) => b.windowLen > 0));
  const latestSingleBucket =
    selectedHistories.length === 1 && period !== 'daily'
      ? selectedHistories[0].history.buckets[selectedHistories[0].history.buckets.length - 1]
      : null;

  // Coming from a WEEKLY_SUMMARY/MONTHLY_SUMMARY/YEARLY_SUMMARY notification
  // (NotificationCenterModal.handlePress) — land directly on that period's
  // tab, anchored to approximately the date range it covers. The backend's
  // periodStart is a real calendar boundary (Monday/1st-of-month/Jan 1);
  // this trailing-window model doesn't have calendar-aligned months/years
  // (see utils/consistency.js), so the anchor used here is "periodStart's
  // own window length later," which lines up exactly for weekly and closely
  // for monthly/yearly — a documented approximation, not a bug.
  useFocusEffect(
    useCallback(() => {
      // Coming from the Profile screen's habit list — tapping a habit name
      // there should select just that habit's own consistency detail.
      if (route.params?.openHabitId) {
        setSelectedHabitIds([route.params.openHabitId]);
        navigation.setParams({ openHabitId: undefined });
        return;
      }
      if (route.params?.periodNav) {
        const { period: navPeriod, anchorDate } = route.params.periodNav;
        if (navPeriod) {
          setPeriod(navPeriod);
          if (anchorDate) {
            const start = new Date(anchorDate);
            const approxDays = navPeriod === 'weekly' ? 7 : navPeriod === 'monthly' ? 30 : navPeriod === 'yearly' ? 365 : 1;
            const end = new Date(start);
            end.setDate(end.getDate() + approxDays - 1);
            setAnchor(end);
          } else {
            setAnchor(new Date());
          }
        }
        navigation.setParams({ periodNav: undefined });
      }
    }, [route.params?.openHabitId, route.params?.periodNav, navigation])
  );

  return (
    <>
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.container, { paddingBottom: spacing.xl + insets.bottom }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        <Text style={styles.title}>Insights</Text>
        <Text style={styles.subtitle}>
          {floors.currentBucketLabel} {floors.periodNoun}, with {floors.buckets.length - 1} {floors.periodNoun}
          {floors.buckets.length - 1 === 1 ? '' : 's'} before it
        </Text>

        <View style={styles.tabRow}>
          {PERIOD_ORDER.map((p) => (
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

        <View ref={tourFloorsCardRef} style={styles.floorsCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Floors built</Text>
            <Text style={styles.floorsTag}>Daily towers</Text>
          </View>

          <Text style={styles.floorsHeadlineNumber}>{floors.currentTotal}</Text>
          <Text style={styles.floorsHeadlineLabel}>so far this {floors.periodNoun}</Text>
          {floors.previousAtThisPointTotal != null ? (
            <Text style={styles.floorsComparison}>
              Last {floors.periodNoun} at this point: {floors.previousAtThisPointTotal}
            </Text>
          ) : null}

          <View style={styles.floorsBarRow}>
            {floors.buckets.map((bucket, i) => {
              const segments = floors.habitLegend
                .map((h) => ({ habit: h, value: bucket.byHabit[h.id] || 0 }))
                .filter((s) => s.value > 0);
              return (
                <View key={i} style={styles.floorsBarColumn}>
                  <View style={styles.floorsBarTrack}>
                    {/* column-reverse so the first-rendered (first-legend-order)
                        habit's segment sits at the bottom of the stack, like a
                        floor actually built first — each segment's height is a
                        % of the bar's own max, so they sum to the bar's total. */}
                    {segments.map(({ habit, value }) => {
                      const pct = maxFloorsBucketValue > 0 ? (value / maxFloorsBucketValue) * 100 : 0;
                      return (
                        <View
                          key={habit.id}
                          style={[styles.floorsBarSegment, { height: `${pct}%`, backgroundColor: habitColor(habit) }]}
                        />
                      );
                    })}
                  </View>
                  <Text style={[styles.floorsBarAxisLabel, bucket.isCurrent && styles.floorsBarAxisLabelCurrent]}>
                    {bucket.label}
                  </Text>
                </View>
              );
            })}
          </View>

          {floors.habitLegend.length > 0 ? (
            <View style={styles.legendRow}>
              {floors.habitLegend.map((h) => (
                <View key={h.id} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: habitColor(h) }]} />
                  <Text style={styles.legendText} numberOfLines={1}>
                    {h.name}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {habits.length === 0 ? (
            <Pressable
              style={styles.emptyCta}
              accessibilityRole="button"
              accessibilityLabel="Add your first habit"
              onPress={() => navigation.navigate('Today')}
            >
              <Text style={styles.emptyCtaText}>Add your first habit</Text>
              <MaterialCommunityIcons name="arrow-right" size={16} color={colors.accent} />
            </Pressable>
          ) : null}
        </View>

        {habits.length > 0 ? (
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
                <GestureDetector gesture={chartGesture}>
                  <View style={styles.card}>
                    <View style={styles.cardHeaderRow}>
                      <View>
                        <Text style={styles.cardTitle}>{HISTORY_TITLES[period]}</Text>
                        <Text style={styles.cardSubtitle}>
                          {HISTORY_SUBTITLES[period]} · pinch to zoom{isDense ? '' : ', swipe to move'}
                        </Text>
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
                      selectedHistories.map(({ habit, history }, historyIndex) => {
                        const colorSet = BAR_COLOR_SETS[historyIndex % BAR_COLOR_SETS.length];
                        const bars = (
                          <View style={[styles.chartRow, isDense && styles.chartRowDense]}>
                            {history.buckets.map((bucket, bucketIndex) => {
                              const pct = maxBucketValue > 0 ? Math.round((bucket.value / maxBucketValue) * 100) : 0;
                              const tappable = Boolean(bucket.dateKey);
                              return (
                                <Pressable
                                  key={bucketIndex}
                                  style={[styles.barColumn, isDense && styles.barColumnDense]}
                                  disabled={!tappable}
                                  onPress={tappable ? () => openBucketInCalendar(period, bucket) : undefined}
                                  accessibilityRole={tappable ? 'button' : undefined}
                                  accessibilityLabel={`${bucket.label || bucketIndex}: ${bucket.value} day${bucket.value === 1 ? '' : 's'}${tappable ? ' — view check-ins' : ''}`}
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
                                  <Text style={styles.barAxisLabel}>{bucket.label}</Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        );
                        return (
                          <View key={habit.id} style={historyIndex > 0 ? styles.summaryBlock : null}>
                            {selectedHistories.length > 1 ? (
                              <Text style={styles.summaryHabitName}>{habit.name}</Text>
                            ) : null}
                            {isDense ? (
                              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {bars}
                              </ScrollView>
                            ) : (
                              bars
                            )}
                          </View>
                        );
                      })
                    ) : (
                      <Text style={styles.emptyText}>No history yet in this window.</Text>
                    )}
                  </View>
                </GestureDetector>

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
        ) : null}
      </ScrollView>

      <CalendarModal
        visible={calendarVisible}
        habits={habits}
        initialAnchorDateKey={calendarAnchorDateKey}
        initialSelectedDayKey={calendarSelectedDayKey}
        onClose={() => setCalendarVisible(false)}
        onToggleHabitDay={handleToggleCalendarDay}
        busy={busy}
      />
    </SafeAreaView>
    <TourHighlight scope={TOUR_SCOPES.INSIGHTS} />
    <Toast toast={toast} onHide={hideToast} />
    </>
  );
}

function makeStyles(colors, typography) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    container: { padding: spacing.xl },
    title: { ...typography.screenTitle },
    subtitle: {
      ...typography.meta,
      marginTop: 2,
      marginBottom: spacing.lg,
    },
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
    tabPillActive: {
      backgroundColor: colors.textPrimary,
    },
    tabText: {
      ...typography.label,
    },
    tabTextActive: {
      color: colors.background,
    },
    periodNavRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    periodNavBtn: {
      width: 32,
      height: 32,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    periodRangeLabelWrap: { alignItems: 'center', minWidth: 140 },
    periodRangeLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary },
    periodRangeSubLabel: { ...typography.meta, marginTop: 1 },
    floorsCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: spacing.xl,
      ...shadow,
    },
    floorsTag: { ...typography.meta },
    floorsHeadlineNumber: {
      fontFamily: fonts.extraBold,
      fontSize: 32,
      color: colors.textPrimary,
      marginTop: spacing.sm,
    },
    floorsHeadlineLabel: { ...typography.body, color: colors.textSecondary, marginTop: -2 },
    floorsComparison: { ...typography.meta, marginTop: 4 },
    floorsBarRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-around',
      marginTop: spacing.lg,
    },
    floorsBarColumn: { alignItems: 'center', flex: 1 },
    floorsBarTrack: {
      width: 20,
      height: BAR_MAX_HEIGHT,
      flexDirection: 'column-reverse',
      backgroundColor: colors.ringTrack,
      borderRadius: radii.sm,
      overflow: 'hidden',
    },
    floorsBarSegment: { width: '100%' },
    floorsBarAxisLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted, marginTop: spacing.sm },
    floorsBarAxisLabelCurrent: { color: colors.textPrimary },
    emptyCta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      marginTop: spacing.md,
      minHeight: 44,
      paddingHorizontal: spacing.md,
    },
    emptyCtaText: { ...typography.label, color: colors.accent },
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
