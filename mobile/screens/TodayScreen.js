import React from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import HabitCard from '../components/HabitCard';
import ProgressRing from '../components/ProgressRing';
import { useHabits } from '../hooks/useHabits';
import { colors, radii, shadow, spacing, typography } from '../theme';

function todayLabel() {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function encouragement({ total, done }) {
  if (total === 0) return 'Add a habit on the Habits tab to get started.';
  if (done === 0) return 'Nothing logged yet — any one of these is a fine place to start.';
  if (done === total) return 'Everything for today is logged. Nice.';
  return `${done} down, ${total - done} still open. No rush.`;
}

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { habits, loading, busy, error, summary, refresh, toggleCheckIn } = useHabits();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: spacing.xl + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        <Text style={styles.date}>{todayLabel()}</Text>
        <Text style={styles.title}>Today</Text>

        <View style={styles.summaryCard}>
          <ProgressRing
            percent={summary.percent}
            size={96}
            color={summary.percent === 100 ? colors.safe : colors.accent}
            label={`${summary.done}/${summary.total}`}
            caption="checked in"
          />

          <View style={styles.summaryText}>
            <Text style={styles.summaryHeadline}>{summary.percent}% of today logged</Text>
            <Text style={styles.summaryStreak}>
              {summary.topStreak} day best streak running
            </Text>
            <Text style={styles.summaryNudge}>{encouragement(summary)}</Text>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

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
        ) : (
          habits.map((habit) => (
            <HabitCard
              key={habit.id}
              name={habit.name}
              category={habit.category}
              cadenceType={habit.cadenceType}
              streak={habit.streak}
              streakStatus={habit.streakStatus}
              checked={habit.checkedInToday}
              disabled={busy}
              onToggle={() => toggleCheckIn(habit.id)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.xl },
  date: { ...typography.meta, marginBottom: spacing.xs },
  title: { ...typography.screenTitle, marginBottom: spacing.lg },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...shadow,
  },
  summaryText: { flex: 1 },
  summaryHeadline: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  summaryStreak: { ...typography.meta, marginTop: spacing.xs },
  summaryNudge: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
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
