import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import CalendarModal from '../components/CalendarModal';
import TreeRingChart from '../components/TreeRingChart';
import TourHighlight from '../components/TourHighlight';
import { categoryIcon } from '../constants/habitCategories';
import { useAppTheme } from '../hooks/useAppTheme';
import { useHabits } from '../hooks/useHabits';
import { useRegisterScrollToTop } from '../hooks/useRegisterScrollToTop';
import { useTourTarget } from '../hooks/useTourTarget';
import { TOUR_SCOPES, TOUR_TARGETS } from '../constants/onboardingTour';
import {
  CONSISTENCY_PERIODS,
  computeConsistency,
  consistencyMessage,
  habitHistorySummary,
  habitPeriodHistory,
  isCurrentPeriod,
  periodRangeLabel,
  shiftAnchor,
} from '../utils/consistency';
import { fonts, gradients, radii, shadow, spacing } from '../theme';

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

const BAR_MAX_HEIGHT = 120;
const HISTORY_TITLES = {
  daily: 'Today, hour by hour',
  weekly: 'This week, day by day',
  monthly: 'This month, week by week',
  yearly: 'This year, month by month',
};
const HISTORY_SUBTITLES = { daily: 'By hour', weekly: 'By day', monthly: 'By week', yearly: 'By month' };
const PERIOD_ORDER = CONSISTENCY_PERIODS;

const PERIOD_LABELS = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
const LIVE_PERIOD_LABELS = { daily: 'Today', weekly: 'This week', monthly: 'This month', yearly: 'This year' };
const PERIOD_TITLES = {
  daily: 'DAILY CONSISTENCY',
  weekly: 'WEEKLY CONSISTENCY',
  monthly: 'MONTHLY CONSISTENCY',
  yearly: 'YEARLY CONSISTENCY',
};

/**
 * Pattern/correlation detection (Phase 5/6) was removed 2026-10-04 — real
 * usage showed it wasn't useful. This screen is now just the consistency
 * summary plus its per-habit bar-graph breakdown (formerly a separate
 * drill-down modal, ConsistencyDetailModal, inlined directly into this page
 * so the detail is visible without an extra tap). Ask Habituate's entry
 * point lives on TodayScreen now (chat icon, top-right header) rather than
 * here — SKILLS.md Phase 10's original placement for its full replacement
 * of pattern detection.
 */
export default function InsightsScreen({ navigation, route }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const insets = useSafeAreaInsets();
  const scrollRef = useRegisterScrollToTop('Insights');

  const { habits, refresh } = useHabits();
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

  const tourConsistencyCardRef = useTourTarget(TOUR_TARGETS.INSIGHTS_CONSISTENCY_CARD);

  const consistency = useMemo(() => computeConsistency(habits, period, anchor), [habits, period, anchor]);
  const message = useMemo(
    () => consistencyMessage(consistency.percent, consistency.hasData),
    [consistency]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const trend = consistency.trendDelta;
  const isLivePeriod = isCurrentPeriod(period, anchor);
  const rangeLabel = periodRangeLabel(period, anchor);
  // Daily (24 hourly bars) and yearly (12 monthly bars) get their own
  // horizontal ScrollView below (see isDense usage further down) — the
  // swipe-to-navigate-period pan gesture is disabled on those so a finger
  // drag over the bars scrolls them instead of fighting the period swipe.
  const isDense = period === 'daily' || period === 'yearly';

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
  const bucketLabels = selectedHistories[0]?.history.buckets.map((b) => b.label) || [];
  const maxBucketValue =
    selectedHistories.length > 0
      ? period === 'daily'
        ? Math.max(1, ...selectedHistories.flatMap(({ history }) => history.buckets.map((b) => b.value)))
        : Math.max(1, ...selectedHistories.flatMap(({ history }) => history.buckets.map((b) => b.windowLen)))
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
        <Text style={styles.subtitle}>Understand your progress. Find your rhythm.</Text>

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

        <View ref={tourConsistencyCardRef} style={styles.consistencyCard}>
          <View style={styles.consistencyHeaderRow}>
            <View>
              <Text style={styles.consistencyLabel}>{PERIOD_TITLES[period]}</Text>
              <Text style={styles.consistencyPercent}>{consistency.percent}%</Text>
            </View>
            {trend != null ? (
              <View style={[styles.trendBadge, trend < 0 && styles.trendBadgeDown]}>
                <MaterialCommunityIcons
                  name={trend >= 0 ? 'arrow-up' : 'arrow-down'}
                  size={12}
                  color={trend >= 0 ? colors.safe : colors.textSecondary}
                />
                <Text style={[styles.trendText, trend < 0 && styles.trendTextDown]}>
                  {trend >= 0 ? '+' : ''}
                  {trend}%
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.messageTitle}>{message.title}</Text>
          <Text style={styles.messageSubtitle}>{message.subtitle}</Text>

          {habits.length === 0 ? (
            <Pressable
              style={styles.emptyCta}
              accessibilityRole="button"
              accessibilityLabel="Add your first habit"
              onPress={() => navigation.navigate('Habits', { openCreateHabit: true })}
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
                      selectedHistories.length === 1 ? (() => {
                        const bars = (
                          <View style={[styles.chartRow, isDense && styles.chartRowDense]}>
                            {bucketLabels.map((label, bucketIndex) => {
                              const bucket = selectedHistories[0].history.buckets[bucketIndex];
                              const pct = maxBucketValue > 0 ? Math.round((bucket.value / maxBucketValue) * 100) : 0;
                              const colorSet = BAR_COLOR_SETS[0];
                              const tappable = period !== 'daily' && bucket.dateKey;
                              return (
                                <Pressable
                                  key={bucketIndex}
                                  style={[styles.barColumn, isDense && styles.barColumnDense]}
                                  disabled={!tappable}
                                  onPress={tappable ? () => openBucketInCalendar(period, bucket) : undefined}
                                  accessibilityRole={tappable ? 'button' : undefined}
                                  accessibilityLabel={`${label || bucketIndex}: ${bucket.value} day${bucket.value === 1 ? '' : 's'}${tappable ? ' — view check-ins' : ''}`}
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
                                </Pressable>
                              );
                            })}
                          </View>
                        );
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
      />
    </SafeAreaView>
    <TourHighlight scope={TOUR_SCOPES.INSIGHTS} />
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
    consistencyCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: spacing.xl,
      ...shadow,
    },
    consistencyHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    consistencyLabel: {
      fontFamily: fonts.bold,
      fontSize: 11,
      color: colors.textMuted,
      letterSpacing: 0.5,
    },
    consistencyPercent: {
      fontFamily: fonts.extraBold,
      fontSize: 32,
      color: colors.textPrimary,
      marginTop: 2,
    },
    trendBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.safeSoft,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 4,
    },
    trendBadgeDown: {
      backgroundColor: colors.neutralSoft,
    },
    trendText: {
      fontFamily: fonts.bold,
      fontSize: 12,
      color: colors.safe,
    },
    trendTextDown: {
      color: colors.textSecondary,
    },
    messageTitle: {
      ...typography.cardTitle,
      marginBottom: 4,
    },
    messageSubtitle: {
      ...typography.body,
      color: colors.textSecondary,
    },
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
