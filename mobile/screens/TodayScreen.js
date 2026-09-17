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
import HabitCard from '../components/HabitCard';
import MotivationBanner from '../components/MotivationBanner';
import { motivationMessage } from '../constants/motivation';
import { DISPLAY_NAME, initials } from '../constants/profile';
import { summarizeHabits, useHabits } from '../hooks/useHabits';
import { byScheduledTime } from '../utils/time';
import { colors, radii, shadow, spacing, typography } from '../theme';

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
  const { habits, loading, busy, error, refresh, toggleCheckIn } = useHabits();
  const [expandedId, setExpandedId] = useState(null);
  const [banner, setBanner] = useState(null);

  // A habit is "today's" when its cadence leaves no slack — every daily habit,
  // a weekly habit targeting all 7 days, or one with as many check-ins left as
  // days left in the period. The rest stay loggable in their own sections with
  // period progress instead of being counted against today.
  const groups = useMemo(() => {
    const due = [];
    const weekly = [];
    const monthly = [];

    habits.forEach((habit) => {
      if (habit.dueToday) due.push(habit);
      else if (String(habit.cadenceType).toUpperCase() === 'MONTHLY') monthly.push(habit);
      else weekly.push(habit);
    });

    [due, weekly, monthly].forEach((list) => list.sort(byScheduledTime));
    return { due, weekly, monthly };
  }, [habits]);

  // "Today's Progress" only counts habits actually due today.
  const summary = useMemo(() => summarizeHabits(groups.due), [groups]);

  // Checking in is the only action that gets a banner; undoing one stays silent.
  const handleToggle = useCallback(
    async (habit) => {
      const wasChecked = habit.checkedInToday;
      await toggleCheckIn(habit.id);

      if (wasChecked) return;

      const remaining = habit.dueToday
        ? Math.max(0, summary.total - summary.done - 1)
        : null;

      setBanner((current) => ({
        key: Date.now(),
        message: motivationMessage(habit, {
          remaining,
          avoid: current ? current.message : null,
        }),
      }));
    },
    [summary, toggleCheckIn]
  );

  const renderHabit = (habit) => (
    <HabitCard
      key={habit.id}
      variant="today"
      name={habit.name}
      category={habit.category}
      cadenceType={habit.cadenceType}
      scheduledTime={habit.scheduledTime}
      progressLabel={habit.progressLabel}
      progressComplete={habit.periodComplete}
      periodDone={habit.periodDone}
      periodTarget={habit.periodTarget}
      periodComplete={habit.periodComplete}
      daysLeft={habit.daysLeftInPeriod}
      checkIns={habit.checkIns}
      expanded={expandedId === habit.id}
      checked={habit.checkedInToday}
      disabled={busy}
      onPress={() => setExpandedId((current) => (current === habit.id ? null : habit.id))}
      onToggle={() => handleToggle(habit)}
    />
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <MotivationBanner
        key={banner ? banner.key : 'idle'}
        message={banner ? banner.message : null}
        onDismiss={() => setBanner(null)}
      />

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
            <View style={[styles.progressFill, { width: `${summary.percent}%` }]} />
          </View>

          <Text style={styles.summaryNudge}>
            {encouragement(summary, habits.length > groups.due.length)}
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Daily Habits</Text>
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
          groups.due.map(renderHabit)
        )}

        {OTHER_CADENCES.map(({ key, title, note }) =>
          groups[key].length > 0 ? (
            <View key={key} style={styles.laterSection}>
              <Text style={styles.sectionTitle}>{title}</Text>
              <Text style={styles.sectionNote}>{note}</Text>
              {groups[key].map(renderHabit)}
            </View>
          ) : null
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    ...shadow,
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
    backgroundColor: colors.safe,
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
