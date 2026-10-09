import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { categoryIcon } from '../constants/habitCategories';
import { CONSISTENCY_PERIODS, habitHistorySummary, habitPeriodHistory } from '../utils/consistency';
import { useAppTheme } from '../hooks/useAppTheme';
import { gradients, radii, shadow, spacing } from '../theme';

const PERIOD_LABELS = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
const HISTORY_TITLES = { daily: 'Daily history', weekly: 'Weekly history', monthly: 'Monthly history', yearly: 'Yearly history' };
const HISTORY_SUBTITLES = {
  daily: 'Last 7 days',
  weekly: 'Last 4 weeks',
  monthly: 'Last 6 months',
  yearly: 'Last 4 years',
};

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
 *   onClose        – () => void
 */
export default function ConsistencyDetailModal({ visible, habits = [], initialPeriod = 'weekly', onClose }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);

  const [period, setPeriod] = useState(initialPeriod);
  // Multi-select: an empty array (on first open) defaults to just the first
  // habit, same single-habit starting point as before — tapping a chip
  // toggles it in/out from there rather than replacing the selection.
  const [selectedHabitIds, setSelectedHabitIds] = useState([]);

  useEffect(() => {
    if (!visible) return;
    setPeriod(initialPeriod);
    setSelectedHabitIds((current) => {
      const stillValid = current.filter((id) => habits.some((h) => h.id === id));
      if (stillValid.length > 0) return stillValid;
      return habits[0] ? [habits[0].id] : [];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialPeriod]);

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
    () => selectedHabits.map((habit) => ({ habit, history: habitPeriodHistory(habit, period) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedHabitIds, period, habits]
  );

  const bucketLabels = selectedHistories[0]?.history.buckets.map((b) => b.label) || [];
  const maxBucketValue =
    selectedHistories.length > 0
      ? Math.max(1, ...selectedHistories.flatMap(({ history }) => history.buckets.map((b) => b.windowLen)))
      : 1;
  const hasAnyWindow = selectedHistories.some(({ history }) => history.buckets.some((b) => b.windowLen > 0));

  const latestSingleBucket =
    selectedHistories.length === 1
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
                onPress={() => setPeriod(p)}
              >
                <Text style={[styles.tabText, period === p && styles.tabTextActive]}>
                  {PERIOD_LABELS[p]}
                </Text>
              </Pressable>
            ))}
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
                      <>
                        <View style={styles.chartRow}>
                          {bucketLabels.map((label, bucketIndex) => (
                            <View key={bucketIndex} style={styles.barColumn}>
                              <View style={styles.barGroup}>
                                {selectedHistories.map(({ habit, history: h }, habitIndex) => {
                                  const bucket = h.buckets[bucketIndex];
                                  const pct = maxBucketValue > 0 ? Math.round((bucket.value / maxBucketValue) * 100) : 0;
                                  const colorSet = BAR_COLOR_SETS[habitIndex % BAR_COLOR_SETS.length];
                                  return (
                                    <View
                                      key={habit.id}
                                      style={[
                                        styles.barTrack,
                                        selectedHistories.length > 1 && styles.barTrackMulti,
                                      ]}
                                    >
                                      {bucket.value > 0 ? (
                                        <LinearGradient
                                          colors={colorSet}
                                          start={{ x: 0, y: 0 }}
                                          end={{ x: 0, y: 1 }}
                                          style={[styles.barFill, { height: `${Math.max(pct, 6)}%` }]}
                                        />
                                      ) : null}
                                    </View>
                                  );
                                })}
                              </View>
                              <Text style={styles.barAxisLabel}>{label}</Text>
                            </View>
                          ))}
                        </View>

                        {selectedHistories.length === 1 ? (
                          <View style={styles.bucketValueRow}>
                            {selectedHistories[0].history.buckets.map((bucket, i) => (
                              <View key={i} style={styles.bucketValuePill}>
                                <Text style={styles.bucketValueText}>
                                  {bucket.value} day{bucket.value === 1 ? '' : 's'}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <View style={styles.legendRow}>
                            {selectedHistories.map(({ habit }, i) => (
                              <View key={habit.id} style={styles.legendItem}>
                                <View
                                  style={[
                                    styles.legendDot,
                                    { backgroundColor: BAR_COLOR_SETS[i % BAR_COLOR_SETS.length][1] },
                                  ]}
                                />
                                <Text style={styles.legendText} numberOfLines={1}>
                                  {habit.name}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </>
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
    barGroup: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
    barTrack: {
      width: 28,
      height: BAR_MAX_HEIGHT,
      justifyContent: 'flex-end',
      backgroundColor: colors.ringTrack,
      borderRadius: radii.sm,
      overflow: 'hidden',
    },
    barTrackMulti: { width: 12 },
    barFill: { width: '100%', borderRadius: radii.sm },
    barAxisLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, marginTop: spacing.sm },
    bucketValueRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: spacing.md,
    },
    bucketValuePill: { flex: 1, alignItems: 'center' },
    bucketValueText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
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
