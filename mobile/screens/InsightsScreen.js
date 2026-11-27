import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../api/client';
import Toast from '../components/Toast';
import { categoryColor, HABIT_CATEGORY_COLORS } from '../constants/habitCategories';
import { resolveHabitColor } from '../constants/towerColors';
import { useAppTheme } from '../hooks/useAppTheme';
import { useHabits } from '../hooks/useHabits';
import { useToast } from '../hooks/useToast';
import { useRegisterScrollToTop } from '../hooks/useRegisterScrollToTop';
import { useTabBarOverlayInset } from '../hooks/useFloatingTabBar';
import { CONSISTENCY_PERIODS, isCurrentPeriod, periodRangeLabel, shiftAnchor, totalFloorsHistory } from '../utils/consistency';
import { hasDailyTarget } from '../utils/cadence';
import { startOfWeek, toDateKey } from '../utils/date';
import { buildLots } from '../utils/lots';
import { plural } from '../utils/insightsDetails';
import { toLotHabit } from '../utils/skylineAdapter';
import { buildCategoryTowerColors, fonts, radii, shadow, skylineTowerTheme, skylineUI, spacing } from '../theme';

// Per-habit color for the new Floors/Runs/Shield-use cards — the raw habit
// record (unlike the Skyline scene/lot builders' transformed shape) has no
// .color of its own; same derivation TodayScreen.js/TowerSheet.js use.
const towerColorsByMode = buildCategoryTowerColors(HABIT_CATEGORY_COLORS);

const BAR_MAX_HEIGHT = 120;
// Phase 5 (design/skyline/06-insights.png): Week/Month/Year only — the old
// Daily tab (24-hourly-bar view) is dropped, owner decision 2026-11-13.
// CONSISTENCY_PERIODS itself still includes 'daily' (computeConsistency/
// habitPeriodHistory's hourly branch stays correct and is still used by
// ProfileScreen.js's weekly-consistency stat), just not offered as a tab
// here anymore.
const PERIOD_ORDER = CONSISTENCY_PERIODS.filter((p) => p !== 'daily');

// Design-review boards 28-30: "Weeks / Months / Years" (Weeks = 8 weekly
// bars, Months = 6 monthly bars, Years = one bar per calendar year).
const PERIOD_LABELS = { weekly: 'Weeks', monthly: 'Months', yearly: 'Years' };
const BAR_COMPARISON_LABELS = {
  weekly: 'Last week at this point',
  monthly: 'Last month at this point',
  yearly: 'Last year to this date',
};
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
  const amber = skylineUI[effectiveMode].amber;
  const styles = useMemo(() => makeStyles(colors, typography, amber), [colors, typography, amber]);
  const insets = useSafeAreaInsets();
  const overlayInset = useTabBarOverlayInset();
  const scrollRef = useRegisterScrollToTop('Insights');
  const habitCategoryColors = towerColorsByMode[effectiveMode];
  const habitColor = useCallback(
    (habit) => resolveHabitColor(habit, effectiveMode, habitCategoryColors) || categoryColor(habit.category),
    [habitCategoryColors, effectiveMode]
  );

  const { habits, refresh } = useHabits();
  const { toast, showToast, hideToast } = useToast();
  const [period, setPeriod] = useState('weekly');
  // The date each period's trailing window ends at — "now" shows the live
  // period; prev/next slide it back/forward a whole window-length at a time
  // (see utils/consistency.js's shiftAnchor), which is what lets this one
  // state value drive weekly/monthly/yearly navigation without a new
  // backend endpoint.
  const [anchor, setAnchor] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  // Habit filter chips (design-review board 23): empty = "All" (every habit
  // counts), non-empty = only those habits feed Floors/Runs/Shield-use.
  // Multi-select — tapping a habit toggles it in/out; tapping "All" clears
  // back to empty.
  const [selectedHabitIds, setSelectedHabitIds] = useState([]);

  useEffect(() => {
    setSelectedHabitIds((current) => current.filter((id) => habits.some((h) => h.id === id)));
  }, [habits]);

  const toggleHabit = (habitId) => {
    setSelectedHabitIds((current) =>
      current.includes(habitId) ? current.filter((id) => id !== habitId) : [...current, habitId]
    );
  };

  const filteredHabits = selectedHabitIds.length === 0 ? habits : habits.filter((h) => selectedHabitIds.includes(h.id));


  const floors = useMemo(() => totalFloorsHistory(filteredHabits, period, anchor), [filteredHabits, period, anchor]);
  const maxFloorsBucketValue = Math.max(1, ...floors.buckets.map((b) => b.value));

  // "Runs" card (Phase 5 follow-up mockup): every habit, current vs. best
  // run. A daily-cadence habit's run is already in days (habit.streak/
  // longestStreak from the backend's StreakCalculator); a weekly/monthly
  // habit has no such field, so it's run through the same buildLots engine
  // the Weekly & Monthly lots view uses, which carries both currentRun and
  // (new this round) bestRun in that habit's own period unit.
  const runsRows = useMemo(() => {
    const dailyRows = filteredHabits
      .filter((h) => hasDailyTarget(h))
      .map((h) => ({
        id: h.id,
        name: h.name,
        color: habitColor(h),
        current: h.streak || 0,
        best: h.longestStreak || 0,
        currentLabel: `${h.streak || 0} day${(h.streak || 0) === 1 ? '' : 's'}`,
        bestLabel: `best ${h.longestStreak || 0}`,
      }));
    const periodOnlyHabits = filteredHabits.filter((h) => !hasDailyTarget(h));
    const lotRows =
      periodOnlyHabits.length === 0
        ? []
        : buildLots(
            periodOnlyHabits.map((h) => toLotHabit(h, habitCategoryColors)),
            { today: anchor }
          ).rows.map((r) => ({
            id: r.habitId,
            name: r.name,
            color: r.color,
            current: r.currentRun,
            best: r.bestRun,
            currentLabel: `${r.currentRun} ${r.periodWord}${r.currentRun === 1 ? '' : 's'}`,
            bestLabel: `best ${r.bestRun}`,
          }));
    const all = [...dailyRows, ...lotRows];
    const maxCurrent = Math.max(0, ...all.map((r) => r.current));
    return all.map((r) => ({ ...r, isBest: maxCurrent > 0 && r.current === maxCurrent }));
  }, [filteredHabits, anchor, habitColor, habitCategoryColors]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const isLivePeriod = isCurrentPeriod(period, anchor);
  const rangeLabel = periodRangeLabel(period, anchor);

  const selectPeriod = (p) => {
    setPeriod(p);
    setAnchor(new Date()); // switching tabs always lands back on the live period
  };
  const goToPreviousPeriod = useCallback(() => setAnchor((a) => shiftAnchor(period, a, -1)), [period]);
  const goToNextPeriod = useCallback(() => {
    setAnchor((a) => (isCurrentPeriod(period, a) ? a : shiftAnchor(period, a, 1)));
  }, [period]);
  const goToNow = () => setAnchor(new Date());

  // Details page for one bucket (boards 31-33). Passes the bucket's own start
  // date plus the chip filter, so the page respects "selected habits only".
  const openDetails = (bucket) => {
    if (!bucket) return;
    navigation.navigate('InsightsDetail', {
      period,
      startMs: bucket.start.getTime(),
      habitIds: selectedHabitIds,
    });
  };

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
        contentContainerStyle={[styles.container, { paddingBottom: spacing.xl + insets.bottom + overlayInset }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        <Text style={styles.title}>Insights</Text>

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

        {habits.length > 0 && (
          <HabitFilterChips
            habits={habits}
            habitColor={habitColor}
            selectedHabitIds={selectedHabitIds}
            onToggleHabit={toggleHabit}
            onSelectAll={() => setSelectedHabitIds([])}
            styles={styles}
            colors={colors}
          />
        )}

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

        <View style={styles.floorsCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Floors built</Text>
            <Text style={styles.floorsTag}>Towers and lots</Text>
          </View>

          <View style={styles.floorsHeadlineRow}>
            <Text style={styles.floorsHeadlineNumber}>{floors.currentTotal.toLocaleString('en-US')}</Text>
            <Text style={styles.floorsHeadlineLabel}>so far this {floors.periodNoun}</Text>
          </View>
          <Text style={styles.floorsComparison}>
            {plural(floors.currentFloors, 'floor')} · {plural(floors.currentLots, 'lot check-in')}
          </Text>
          {floors.previousAtThisPointTotal != null ? (
            <Text style={styles.floorsComparison}>
              {BAR_COMPARISON_LABELS[period]}: {floors.previousAtThisPointTotal.toLocaleString('en-US')}
            </Text>
          ) : null}

          <View style={styles.floorsBarRow}>
            {floors.buckets.map((bucket, i) => {
              const segments = floors.habitLegend
                .map((h) => ({ habit: h, value: bucket.byHabit[h.id] || 0 }))
                .filter((s) => s.value > 0);
              return (
                <Pressable
                  key={i}
                  style={styles.floorsBarColumn}
                  onPress={() => openDetails(bucket)}
                  testID={`insights-floors-bar-${i}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${bucket.label}, ${bucket.value} built, open details`}
                >
                  <View style={[styles.floorsBarTrack, floors.buckets.length <= 3 && styles.floorsBarTrackWide]}>
                    {/* column-reverse so the first-legend-order habit's segment
                        sits at the bottom, like a floor built first — each
                        segment's height is a share of the tallest bar, so
                        they sum to the bar's own total. */}
                    {segments.map(({ habit, value }) => {
                      const pct = maxFloorsBucketValue > 0 ? (value / maxFloorsBucketValue) * 100 : 0;
                      return (
                        <View
                          key={habit.id}
                          style={[styles.floorsBarSegment, { height: `${pct}%`, backgroundColor: habitColor(habit) }]}
                        />
                      );
                    })}
                    {segments.length === 0 ? <View style={styles.floorsBarEmpty} /> : null}
                  </View>
                  <Text style={[styles.floorsBarAxisLabel, bucket.isCurrent && styles.floorsBarAxisLabelCurrent]}>
                    {bucket.label}
                  </Text>
                </Pressable>
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
              accessibilityLabel="Lay a foundation"
              onPress={() => navigation.navigate('Today')}
            >
              <Text style={styles.emptyCtaText}>Lay a foundation</Text>
              <MaterialCommunityIcons name="arrow-right" size={16} color={colors.accent} />
            </Pressable>
          ) : (
            <Pressable
              style={styles.floorsFooter}
              onPress={() => openDetails(floors.buckets[floors.buckets.length - 1])}
              testID="insights-floors-footer"
              accessibilityRole="button"
              accessibilityLabel={`Tap a bar to see everything for that ${floors.periodNoun}`}
            >
              <Text style={styles.floorsFooterText}>Tap a bar to see everything for that {floors.periodNoun}</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={amber} />
            </Pressable>
          )}
        </View>

        {runsRows.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Runs</Text>
              <Text style={styles.floorsTag}>Current and best</Text>
            </View>
            {runsRows.map((row) => (
              <View key={row.id} style={styles.runRow}>
                <View style={styles.runRowHeader}>
                  <View style={[styles.legendDot, { backgroundColor: row.color }]} />
                  <Text style={styles.runName} numberOfLines={1}>
                    {row.name}
                  </Text>
                  {row.isBest ? (
                    <View style={styles.bestBadge}>
                      <Text style={styles.bestBadgeText}>Best</Text>
                    </View>
                  ) : null}
                  <Text style={styles.runCurrent}>{row.currentLabel}</Text>
                </View>
                <View style={styles.runBarRow}>
                  <View style={styles.runBarTrack}>
                    <View
                      style={[
                        styles.runBarFill,
                        { width: `${row.best > 0 ? Math.min(100, (row.current / row.best) * 100) : 0}%`, backgroundColor: row.color },
                      ]}
                    />
                    <View style={styles.runBarTick} />
                  </View>
                  <Text style={styles.runBestLabel}>{row.bestLabel}</Text>
                </View>
              </View>
            ))}
            <Text style={styles.runFootnote}>The white mark is your best run.</Text>
          </View>
        ) : null}

        <ShieldUseCard
          habits={filteredHabits}
          habitColor={habitColor}
          colors={colors}
          towerTheme={skylineTowerTheme[effectiveMode]}
          styles={styles}
        />
      </ScrollView>
    </SafeAreaView>
    <Toast toast={toast} onHide={hideToast} />
    </>
  );
}

/**
 * Habit filter chips (design-review board 23, owner-approved 2026-11-13):
 * "Habits" label, an "All" chip, then one chip per habit with its color
 * dot. Multi-select — tapping "All" clears back to showing everything;
 * tapping a habit toggles it. Filters Floors built, Runs and Shield use
 * at once (Floors built stays daily-towers-only regardless, since a
 * weekly/monthly habit never builds a floor).
 */
function HabitFilterChips({ habits, habitColor, selectedHabitIds, onToggleHabit, onSelectAll, styles, colors }) {
  const allSelected = selectedHabitIds.length === 0;
  return (
    <View style={styles.habitChipsRow}>
      <Text style={styles.habitChipsLabel}>Habits</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.habitChipsScroll}>
        <Pressable
          style={[styles.habitChip, allSelected && styles.habitChipSelected]}
          onPress={onSelectAll}
          hitSlop={{ top: 5, bottom: 5 }}
          testID="insights-habit-chip-all"
          accessibilityRole="button"
          accessibilityLabel={`All, ${allSelected ? 'selected' : 'not selected'}`}
        >
          <Text style={[styles.habitChipText, allSelected && styles.habitChipTextSelected]}>All</Text>
        </Pressable>
        {habits.map((habit) => {
          const selected = selectedHabitIds.includes(habit.id);
          return (
            <Pressable
              key={habit.id}
              style={[styles.habitChip, selected && styles.habitChipSelected]}
              onPress={() => onToggleHabit(habit.id)}
              hitSlop={{ top: 5, bottom: 5 }}
              testID={`insights-habit-chip-${habit.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${habit.name}, ${selected ? 'selected' : 'not selected'}`}
            >
              <View style={[styles.habitChipDot, { backgroundColor: habitColor(habit) }]} />
              <Text style={[styles.habitChipText, selected && styles.habitChipTextSelected]} numberOfLines={1}>
                {habit.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const SHIELD_WINDOW_WEEKS = 12;

/**
 * "Shield use" (Phase 5 follow-up mockup): total Shield Days used and how
 * many habits used one, then a per-habit 12-week dot timeline with a
 * filled square on each week a Shield Day actually landed. Fetches every
 * visible habit's shielded dates on demand (api.getShieldedDates, same
 * deliberate not-in-useHabits'-global-refresh decision Phase 3's
 * TowerInsideView.js made — this card already does N requests at once,
 * adding a global poll on top would make every Insights refresh N times
 * more expensive for data that rarely changes).
 */
function ShieldUseCard({ habits, habitColor, colors, towerTheme, styles }) {
  const [shieldedByHabit, setShieldedByHabit] = useState({});
  const habitIds = habits.map((h) => h.id).join(',');

  useEffect(() => {
    if (habits.length === 0) {
      setShieldedByHabit({});
      return undefined;
    }
    let cancelled = false;
    Promise.all(
      habits.map((h) =>
        api
          .getShieldedDates(h.id)
          .then((dates) => [h.id, dates || []])
          .catch(() => [h.id, []])
      )
    ).then((pairs) => {
      if (!cancelled) setShieldedByHabit(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
    // habits themselves change identity on every refresh; habitIds is the
    // real dependency (only refetch when the actual set of habits changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habitIds]);

  const todayKey = toDateKey(new Date());
  const windowStart = startOfWeek(new Date());
  windowStart.setDate(windowStart.getDate() - (SHIELD_WINDOW_WEEKS - 1) * 7);
  const windowStartKey = toDateKey(windowStart);

  const rows = habits
    .map((h) => {
      const allDates = shieldedByHabit[h.id] || [];
      const inWindow = allDates.filter((d) => d >= windowStartKey && d <= todayKey);
      if (inWindow.length === 0) return null;
      const weeks = Array.from({ length: SHIELD_WINDOW_WEEKS }, (_, i) => {
        const weekStart = new Date(windowStart);
        weekStart.setDate(weekStart.getDate() + i * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const weekEndKey = toDateKey(weekEnd);
        const weekStartKey = toDateKey(weekStart);
        return { used: inWindow.some((d) => d >= weekStartKey && d < weekEndKey) };
      });
      return { id: h.id, name: h.name, color: habitColor(h), weeks, count: inWindow.length };
    })
    .filter(Boolean);

  if (rows.length === 0) return null;

  const totalUsed = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>Shield use</Text>
        <Text style={styles.floorsTag}>Last {SHIELD_WINDOW_WEEKS} weeks</Text>
      </View>

      <View style={styles.shieldStatsRow}>
        <View style={styles.shieldStatTile}>
          <Text style={styles.shieldStatNumber}>{totalUsed}</Text>
          <Text style={styles.shieldStatLabel}>Shield Days used</Text>
        </View>
        <View style={styles.shieldStatTile}>
          <Text style={styles.shieldStatNumber}>{rows.length}</Text>
          <Text style={styles.shieldStatLabel}>habit{rows.length === 1 ? '' : 's'} used one</Text>
        </View>
      </View>

      {rows.map((row) => (
        <View key={row.id} style={styles.shieldRow}>
          <View style={[styles.legendDot, { backgroundColor: row.color }]} />
          <Text style={styles.shieldRowName} numberOfLines={1}>
            {row.name}
          </Text>
          <View style={styles.shieldDotsRow}>
            {row.weeks.map((w, i) =>
              w.used ? (
                <View
                  key={i}
                  style={[
                    styles.shieldDotGlass,
                    { backgroundColor: towerTheme.shieldFill, borderColor: towerTheme.shieldEdge },
                  ]}
                >
                  <MaterialCommunityIcons name="shield" size={7} color={towerTheme.shieldIcon} />
                </View>
              ) : (
                <View key={i} style={styles.shieldDot} />
              )
            )}
          </View>
        </View>
      ))}

      <View style={styles.shieldAxisRow}>
        <Text style={styles.floorsBarAxisLabel}>
          {windowStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </Text>
        <Text style={styles.floorsBarAxisLabel}>Now</Text>
      </View>

      <Text style={styles.runFootnote}>A Shield Day is a glass floor with a shield on the tower. It keeps the run going.</Text>
    </View>
  );
}

function makeStyles(colors, typography, amber) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    container: { padding: spacing.xl },
    title: { ...typography.screenTitle, marginBottom: spacing.lg },
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
    floorsHeadlineRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.sm },
    floorsHeadlineNumber: {
      fontFamily: fonts.extraBold,
      fontSize: 40,
      color: colors.textPrimary,
    },
    floorsHeadlineLabel: { ...typography.body, color: colors.textSecondary },
    floorsComparison: { ...typography.meta, marginTop: 4 },
    floorsFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
      marginTop: spacing.md,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    floorsFooterText: { fontFamily: fonts.bold, fontSize: 14, color: amber, flex: 1 },
    floorsBarRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-around',
      marginTop: spacing.lg,
    },
    floorsBarColumn: { alignItems: 'center', flex: 1 },
    floorsBarTrack: {
      width: 26,
      height: BAR_MAX_HEIGHT,
      flexDirection: 'column-reverse',
      justifyContent: 'flex-start',
      gap: 1,
      overflow: 'hidden',
    },
    floorsBarTrackWide: { width: 72 },
    floorsBarSegment: { width: '100%', borderRadius: 2 },
    floorsBarEmpty: { width: '100%', height: 2, backgroundColor: colors.ringTrack },
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
    habitChipsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    habitChipsLabel: { ...typography.meta, marginRight: 2 },
    habitChipsScroll: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    habitChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 34,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.sm + 4,
      paddingVertical: 6,
    },
    habitChipSelected: {
      backgroundColor: `${amber}2E`,
      borderColor: amber,
    },
    habitChipDot: { width: 8, height: 8, borderRadius: radii.pill },
    habitChipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    habitChipTextSelected: { color: colors.textPrimary, fontWeight: '700' },
    legendRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      marginTop: spacing.md,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: 140 },
    legendDot: { width: 8, height: 8, borderRadius: radii.pill },
    legendText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    runRow: { marginTop: spacing.md },
    runRowHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    runName: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    bestBadge: {
      backgroundColor: colors.accent,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    bestBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
    runCurrent: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
    runBarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 },
    runBarTrack: {
      flex: 1,
      height: 6,
      borderRadius: radii.pill,
      backgroundColor: colors.ringTrack,
      overflow: 'visible',
      justifyContent: 'center',
    },
    runBarFill: { height: 6, borderRadius: radii.pill },
    runBarTick: {
      position: 'absolute',
      right: -1,
      width: 2,
      height: 14,
      backgroundColor: '#FFFFFF',
      borderRadius: 1,
    },
    runBestLabel: { fontSize: 11, color: colors.textMuted, width: 48, textAlign: 'right' },
    runFootnote: { ...typography.meta, marginTop: spacing.md },
    shieldStatsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm, marginBottom: spacing.md },
    shieldStatTile: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: radii.md,
      padding: spacing.md,
    },
    shieldStatNumber: { fontFamily: fonts.extraBold, fontSize: 24, color: colors.textPrimary },
    shieldStatLabel: { ...typography.meta, marginTop: 2 },
    shieldRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
    shieldRowName: { width: 72, fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    shieldDotsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    shieldDot: { width: 6, height: 6, borderRadius: radii.pill, backgroundColor: colors.border },
    shieldDotGlass: {
      width: 11,
      height: 11,
      borderRadius: 2,
      borderWidth: 1,
      opacity: 0.85,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shieldAxisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, marginLeft: 72 + spacing.sm },
  });
}
