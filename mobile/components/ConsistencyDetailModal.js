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
  const [selectedHabitId, setSelectedHabitId] = useState(null);

  useEffect(() => {
    if (!visible) return;
    setPeriod(initialPeriod);
    setSelectedHabitId((current) => {
      if (current && habits.some((h) => h.id === current)) return current;
      return habits[0]?.id ?? null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialPeriod]);

  const selectedHabit = habits.find((h) => h.id === selectedHabitId) || null;

  const history = useMemo(
    () => (selectedHabit ? habitPeriodHistory(selectedHabit, period) : null),
    [selectedHabit, period]
  );
  const summary = useMemo(() => (history ? habitHistorySummary(history) : ''), [history]);
  const maxBucketValue = history ? Math.max(1, ...history.buckets.map((b) => b.windowLen)) : 1;
  const latestBucket = history ? history.buckets[history.buckets.length - 1] : null;

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
              {selectedHabit
                ? `${PERIOD_LABELS[period]} rhythm for ${selectedHabit.name}`
                : 'Add a habit to see its rhythm'}
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
                  <Text style={styles.cardTitle}>Selected habit</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>
                      {habits.length} habit{habits.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  {habits.map((habit) => {
                    const selected = habit.id === selectedHabitId;
                    return (
                      <Pressable
                        key={habit.id}
                        style={[styles.chip, selected && styles.chipSelected]}
                        onPress={() => setSelectedHabitId(habit.id)}
                      >
                        <MaterialCommunityIcons
                          name={categoryIcon(habit.category)}
                          size={20}
                          color={selected ? colors.safe : colors.textSecondary}
                        />
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>
                          {habit.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {selectedHabit && history ? (
                <>
                  <View style={styles.card}>
                    <View style={styles.cardHeaderRow}>
                      <View>
                        <Text style={styles.cardTitle}>{HISTORY_TITLES[period]}</Text>
                        <Text style={styles.cardSubtitle}>{HISTORY_SUBTITLES[period]}</Text>
                      </View>
                      {latestBucket && latestBucket.value > 0 ? (
                        <View style={styles.statusPill}>
                          <View style={styles.statusDot} />
                          <Text style={styles.statusText}>
                            {latestBucket.windowLen > 0 && latestBucket.value >= latestBucket.windowLen
                              ? 'Completed'
                              : 'In progress'}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.chartRow}>
                      {history.buckets.map((bucket, i) => {
                        const pct = maxBucketValue > 0 ? Math.round((bucket.value / maxBucketValue) * 100) : 0;
                        return (
                          <View key={i} style={styles.barColumn}>
                            <View style={styles.barTrack}>
                              {bucket.value > 0 ? (
                                <LinearGradient
                                  colors={gradients.safe}
                                  start={{ x: 0, y: 0 }}
                                  end={{ x: 0, y: 1 }}
                                  style={[styles.barFill, { height: `${Math.max(pct, 6)}%` }]}
                                />
                              ) : null}
                            </View>
                            <Text style={styles.barAxisLabel}>{bucket.label}</Text>
                          </View>
                        );
                      })}
                    </View>

                    <View style={styles.bucketValueRow}>
                      {history.buckets.map((bucket, i) => (
                        <View key={i} style={styles.bucketValuePill}>
                          <Text style={styles.bucketValueText}>
                            {bucket.value} day{bucket.value === 1 ? '' : 's'}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Selected-period details</Text>
                    <Text style={styles.summaryText}>{summary}</Text>
                  </View>
                </>
              ) : null}
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
    barTrack: {
      width: 28,
      height: BAR_MAX_HEIGHT,
      justifyContent: 'flex-end',
      backgroundColor: colors.ringTrack,
      borderRadius: radii.sm,
      overflow: 'hidden',
    },
    barFill: { width: '100%', borderRadius: radii.sm },
    barAxisLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, marginTop: spacing.sm },
    bucketValueRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: spacing.md,
    },
    bucketValuePill: { flex: 1, alignItems: 'center' },
    bucketValueText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
    summaryText: { ...typography.body, color: colors.textSecondary, lineHeight: 20 },
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  });
}
