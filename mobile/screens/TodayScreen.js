import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import HabitCard from '../components/HabitCard';
import GoalsSummaryCard from '../components/GoalsSummaryCard';
import { DISPLAY_NAME, initials } from '../constants/profile';
import { useCelebration } from '../hooks/useCelebration';
import { useFeaturedGoalReviews } from '../hooks/useFeaturedGoalReviews';
import { useGoals } from '../hooks/useGoals';
import { summarizeHabits, useHabits } from '../hooks/useHabits';
import { buildAllDoneCelebration, buildCheckInCelebration, buildHabitMilestone } from '../utils/celebration';
import { effectiveMonthlyTarget, effectiveWeeklyTarget } from '../utils/cadence';
import { daysLeftInMonth, daysLeftInWeek } from '../utils/date';
import { byScheduledTime } from '../utils/time';
import { useAppTheme } from '../hooks/useAppTheme';
import { gradients, radii, shadow, shadowLg, spacing } from '../theme';

// Shown below the daily list so a weekly habit can still be logged from Today
// without being counted against today's progress.
const OTHER_CADENCES = [
  { key: 'weekly', title: 'This Week', note: 'Open any day this week — log one when it fits.' },
  { key: 'monthly', title: 'This Month', note: 'Open any day this month. No rush.' },
];

function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 18) return 'Good afternoon,';
  return 'Good evening,';
}

function encouragement({ total, done }, hasOtherHabits = false) {
  if (total === 0) {
    return hasOtherHabits
      ? 'Nothing due today — your weekly and monthly habits are below.'
      : 'Add a habit on the Habits tab to get started.';
  }
  if (done === 0) return 'Nothing logged yet — any one of these is a fine place to start.';
  if (done === total) return 'Everything for today is logged. Nice.';

  const left = total - done;
  return left === 1
    ? "You're doing great! Just one more habit to go."
    : `You're doing great! ${left} more habits to go.`;
}

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { habits, loading, busy, error, refresh, toggleCheckIn, addCheckIn, removeLastCheckIn } =
    useHabits();
  const { goals } = useGoals();
  const { celebrate: showCelebration } = useCelebration();
  const [expandedId, setExpandedId] = useState(null);

  const featuredHabits = useMemo(() => habits.filter((h) => h.featuredGoal), [habits]);
  const { reviews: habitGoalReviews } = useFeaturedGoalReviews(featuredHabits);

  // One combined list so the summary card can report across both habit-linked
  // and freeform goals without caring which is which. `percent` carries actual
  // partial progress (not just done/not-done) so the summary bar reflects
  // trend rather than looking empty until something hits 100%.
  const goalItems = useMemo(
    () => [
      ...featuredHabits.map((h) => ({
        id: `habit-${h.id}`,
        complete: h.periodComplete,
        percent: h.periodTarget > 0 ? Math.min(100, Math.round((h.periodDone / h.periodTarget) * 100)) : 0,
        needsReview: habitGoalReviews.some((r) => r.habit.id === h.id),
      })),
      ...goals.map((g) => ({
        id: `goal-${g.id}`,
        complete: g.complete,
        percent: g.percent,
        needsReview: g.needsReview,
      })),
    ],
    [featuredHabits, habitGoalReviews, goals]
  );

  // "Due Today" is only genuinely daily habits (habit.dueToday, from
  // isDueToday in cadence.js). A habit whose target lives at the weekly or
  // monthly scale — gym 2x/week, 50 applications/month — is never pulled in
  // here just because slack is running low: it can happen on any day of its
  // period, so it always lives in its own section below with its own period
  // progress, and never inflates Today's Progress.
  const groups = useMemo(() => {
    const due = [];
    const weekly = [];
    const monthly = [];

    habits.forEach((habit) => {
      if (habit.dueToday) {
        due.push(habit);
      } else if (effectiveMonthlyTarget(habit) > 0 && effectiveWeeklyTarget(habit) === 0) {
        // Monthly-only target
        monthly.push(habit);
      } else if (effectiveWeeklyTarget(habit) > 0 || effectiveMonthlyTarget(habit) > 0) {
        // Has a weekly target (or both weekly+monthly)
        weekly.push(habit);
      } else {
        // Pure daily habit that's already met today's target
        due.push(habit);
      }
    });

    [due, weekly, monthly].forEach((list) => list.sort(byScheduledTime));
    return { due, weekly, monthly };
  }, [habits]);

  // "Today's Progress" only counts habits actually due today.
  const summary = useMemo(() => summarizeHabits(groups.due), [groups]);

  // Logging progress is the only action that gets a celebration; undoing stays
  // silent. Priority when more than one applies on the same check-in: a
  // habit's own target being met, then finishing every habit due today, then
  // the routine card — showing more than one at once would be excessive. The
  // routine card only shows on the FIRST check-in of the day for a habit —
  // a count-mode habit tapped 5 times for 5 applications shouldn't pop up 5
  // times, though a milestone crossed on tap 3 still always shows.
  const celebrate = useCallback(
    (habit, delta = 1) => {
      const previousDone = summary.done;
      const todayDone = habit.dueToday ? Math.min(summary.total, previousDone + delta) : previousDone;

      const payload =
        buildHabitMilestone(habit, delta, { todayDone, todayTotal: summary.total }) ||
        buildAllDoneCelebration(previousDone, todayDone, summary.total) ||
        (habit.checkedInToday
          ? null
          : buildCheckInCelebration(habit, delta, { todayDone, todayTotal: summary.total }));
      if (payload) showCelebration(payload);
    },
    [summary, showCelebration]
  );

  const handleToggle = useCallback(
    async (habit) => {
      const wasChecked = habit.checkedInToday;
      await toggleCheckIn(habit.id);
      if (!wasChecked) celebrate(habit, 1);
    },
    [toggleCheckIn, celebrate]
  );

  const handleAdd = useCallback(
    async (habit) => {
      await addCheckIn(habit.id);
      celebrate(habit, 1);
    },
    [addCheckIn, celebrate]
  );

  const handleLogAmount = useCallback(
    async (habit, amount) => {
      await addCheckIn(habit.id, amount);
      celebrate(habit, amount);
    },
    [addCheckIn, celebrate]
  );

  // A habit with both a weekly and a monthly target still has only one bar
  // on its card — it needs to reflect whichever scale this section is about,
  // not always the "primary" (monthly-first) number cadenceProgress picks.
  // Otherwise a card sitting under "This Week" can show 20% from the monthly
  // count even though the week's own target was just fully met.
  const focusedProgress = (habit, focus) => {
    if (focus === 'weekly') {
      const target = habit.weeklyTarget || 0;
      return {
        periodDone: habit.weeklyDone || 0,
        periodTarget: target,
        periodNoun: 'this week',
        periodComplete: target > 0 && (habit.weeklyDone || 0) >= target,
        daysLeft: daysLeftInWeek(),
      };
    }
    if (focus === 'monthly') {
      const target = habit.monthlyTarget || 0;
      return {
        periodDone: habit.monthlyDone || 0,
        periodTarget: target,
        periodNoun: 'this month',
        periodComplete: target > 0 && (habit.monthlyDone || 0) >= target,
        daysLeft: daysLeftInMonth(),
      };
    }
    return {
      periodDone: habit.periodDone,
      periodTarget: habit.periodTarget,
      periodNoun: habit.periodNoun,
      periodComplete: habit.periodComplete,
      daysLeft: habit.daysLeftInPeriod,
    };
  };

  const renderHabit = (habit, focus = 'daily') => {
    const progress = focusedProgress(habit, focus);
    return (
      <HabitCard
        key={habit.id}
        variant="today"
        name={habit.name}
        category={habit.category}
        cadenceType={habit.cadenceType}
        trackingMode={habit.trackingMode}
        todayCount={habit.todayCount}
        scheduledTime={habit.scheduledTime}
        progressLabel={habit.progressLabel}
        progressComplete={progress.periodComplete}
        periodDone={progress.periodDone}
        periodTarget={progress.periodTarget}
        periodNoun={progress.periodNoun}
        daysLeft={progress.daysLeft}
        checkIns={habit.checkIns}
        expanded={expandedId === habit.id}
        checked={habit.checkedInToday}
        disabled={busy}
        onPress={() => setExpandedId((current) => (current === habit.id ? null : habit.id))}
        onToggle={() => handleToggle(habit)}
        onAdd={() => handleAdd(habit)}
        onRemoveLast={() => removeLastCheckIn(habit.id)}
        onLogAmount={(amount) => handleLogAmount(habit, amount)}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: spacing.xl + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.name}>{DISPLAY_NAME}</Text>
          </View>

          <Pressable
            style={styles.avatar}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.avatarText}>{initials()}</Text>
          </Pressable>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View style={styles.summaryText}>
              <Text style={styles.summaryLabel}>Today's Progress</Text>
              <Text style={styles.summaryCount}>
                {summary.done}/{summary.total}
              </Text>
            </View>

            <View style={styles.summaryBadge}>
              <MaterialCommunityIcons
                name="check-circle-outline"
                size={28}
                color={colors.safe}
              />
            </View>
          </View>

          <View style={styles.progressTrack}>
            <LinearGradient
              colors={gradients.safe}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${summary.percent}%` }]}
            />
          </View>

          <Text style={styles.summaryNudge}>
            {encouragement(summary, habits.length > groups.due.length)}
          </Text>
        </View>

        <GoalsSummaryCard
          items={goalItems}
          onPress={() => navigation.navigate('Habits', { scrollToGoals: true })}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Due Today</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="See all habits"
            onPress={() => navigation.navigate('Habits')}
          >
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>

        {loading && habits.length === 0 ? (
          <View style={styles.loaderRow}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.loaderText}>Loading habits…</Text>
          </View>
        ) : habits.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nothing to track yet</Text>
            <Text style={styles.emptyBody}>
              Head to the Habits tab and add your first habit. Start with one — you can always
              add more later.
            </Text>
          </View>
        ) : groups.due.length === 0 ? (
          <Text style={styles.sectionNote}>
            Nothing has to happen today — your weekly and monthly habits are below.
          </Text>
        ) : (
          groups.due.map((habit) => renderHabit(habit, 'daily'))
        )}

        {OTHER_CADENCES.map(({ key, title, note }) =>
          groups[key].length > 0 ? (
            <View key={key} style={styles.laterSection}>
              <Text style={styles.sectionTitle}>{title}</Text>
              <Text style={styles.sectionNote}>{note}</Text>
              {groups[key].map((habit) => renderHabit(habit, key))}
            </View>
          ) : null
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors, typography) {
  return StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  headerText: { flex: 1 },
  greeting: { fontSize: 14, color: colors.textSecondary },
  name: { ...typography.screenTitle, marginTop: 2 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: colors.accent },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    ...shadowLg,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  summaryText: { flex: 1 },
  summaryLabel: { fontSize: 14, color: colors.textSecondary },
  summaryCount: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  summaryBadge: {
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.safeSoft,
  },
  progressTrack: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.ringTrack,
    overflow: 'hidden',
    marginTop: spacing.lg,
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  summaryNudge: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: { ...typography.sectionTitle, fontSize: 18 },
  seeAll: { fontSize: 14, fontWeight: '600', color: colors.accent },
  laterSection: { marginTop: spacing.lg },
  sectionNote: { ...typography.meta, marginBottom: spacing.md },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  loaderText: { ...typography.body, color: colors.textSecondary },
  error: { color: colors.atRisk, fontSize: 13, marginBottom: spacing.md },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadow,
  },
  emptyTitle: { ...typography.cardTitle, marginBottom: spacing.sm },
  emptyBody: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  });
}
