import React, { useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import CalendarModal from '../components/CalendarModal';
import Dropdown from '../components/Dropdown';
import HabitCard from '../components/HabitCard';
import {
  DEFAULT_HABIT_CATEGORY,
  HABIT_CATEGORY_OPTIONS,
} from '../constants/habitCategories';
import { effectiveMonthlyTarget, effectiveWeeklyTarget, hasDailyTarget } from '../utils/cadence';
import { useHabits } from '../hooks/useHabits';
import { formatTime, parseTimeInput } from '../utils/time';
import { colors, radii, shadow, spacing, typography } from '../theme';

const emptyForm = {
  id: null,
  name: '',
  category: DEFAULT_HABIT_CATEGORY,
  // dailyTarget: how many times per day (blank = 1, i.e. once is enough)
  dailyTarget: '',
  // weeklyTarget / monthlyTarget: optional count goals at those scales
  weeklyTarget: '',
  monthlyTarget: '',
  // BOOLEAN: once a day, toggled on/off. COUNT: any number of check-ins a
  // day, each adding to the period total — needed for targets like "50 job
  // applications this month" that can't be satisfied one-per-day.
  trackingMode: 'BOOLEAN',
  scheduledTime: '',
  reminderEnabled: false,
};

function formFromHabit(habit) {
  const key = String(habit.cadenceType || 'DAILY').toUpperCase();
  const isOldPeriodHabit = key === 'WEEKLY' || key === 'MONTHLY';

  // Prefer the cadenceProgress-enriched fields (already resolved effective values),
  // then fall back to effectiveWeeklyTarget/effectiveMonthlyTarget for raw API shapes.
  const wt = (habit.weeklyTarget > 0 ? habit.weeklyTarget : null)
    || effectiveWeeklyTarget(habit)
    || 0;
  const mt = (habit.monthlyTarget > 0 ? habit.monthlyTarget : null)
    || effectiveMonthlyTarget(habit)
    || 0;

  return {
    id: habit.id,
    name: habit.name || '',
    category: HABIT_CATEGORY_OPTIONS.some((o) => o.value === habit.category)
      ? habit.category
      : DEFAULT_HABIT_CATEGORY,
    dailyTarget: !isOldPeriodHabit && habit.cadenceTarget && habit.cadenceTarget > 1
      ? String(habit.cadenceTarget)
      : '',
    weeklyTarget: wt > 0 ? String(wt) : '',
    monthlyTarget: mt > 0 ? String(mt) : '',
    trackingMode: String(habit.trackingMode || 'BOOLEAN').toUpperCase() === 'COUNT'
      ? 'COUNT'
      : 'BOOLEAN',
    scheduledTime: formatTime(habit.scheduledTime),
    reminderEnabled: Boolean(habit.reminderEnabled),
  };
}

/** cadenceType is always DAILY — grouping is now driven by which targets are set, not this field. */
function deriveCadenceType() {
  return 'DAILY';
}

export default function HabitsScreen() {
  const insets = useSafeAreaInsets();
  const {
    habits,
    archivedHabits,
    busy,
    toggleCheckIn,
    addCheckIn,
    removeLastCheckIn,
    createHabit,
    updateHabit,
    archiveHabit,
    restoreHabit,
    deleteHabit,
  } = useHabits();
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const scrollRef = useRef(null);

  const isEditing = form.id != null;

  // The form renders above the list, so bring it into view when editing a habit
  // the user had to scroll down to reach.
  const scrollToForm = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ y: 0, animated: true });
    }
  };

  const closeForm = () => {
    setForm(emptyForm);
    setShowForm(false);
  };

  const openCreate = () => {
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (habit) => {
    setForm(formFromHabit(habit));
    setShowForm(true);
    scrollToForm();
  };

  const submit = async () => {
    const name = form.name.trim();
    if (!name) {
      Alert.alert('Missing habit name', 'Give the habit a name first.');
      return;
    }

    // Both the time and the reminder are optional; only a typo blocks saving.
    const timeText = form.scheduledTime.trim();
    const scheduledTime = timeText ? parseTimeInput(timeText) : '';
    if (timeText && !scheduledTime) {
      Alert.alert('Check the time', 'Use a time like 8:00 AM or 19:30 — or leave it blank.');
      return;
    }

    const dailyTarget = Number(form.dailyTarget) || 1;
    const weeklyTarget = Number(form.weeklyTarget) || null;
    const monthlyTarget = Number(form.monthlyTarget) || null;

    const payload = {
      name,
      category: form.category || DEFAULT_HABIT_CATEGORY,
      cadenceType: deriveCadenceType(form),
      cadenceTarget: dailyTarget,
      weeklyTarget,
      monthlyTarget,
      trackingMode: form.trackingMode,
      scheduledTime,
      reminderEnabled: Boolean(scheduledTime) && form.reminderEnabled,
    };

    try {
      if (isEditing) {
        await updateHabit(form.id, payload);
      } else {
        await createHabit(payload);
      }
      closeForm();
    } catch (err) {
      Alert.alert(
        isEditing ? 'Could not save changes' : 'Could not create habit',
        err instanceof Error ? err.message : 'Unknown error'
      );
    }
  };

  // Archiving keeps the history intact — nothing is deleted and no progress is lost.
  const confirmArchive = () => {
    Alert.alert(
      'Archive this habit?',
      'It moves out of your active list. Your check-ins and streak history stay saved.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Archive',
          onPress: async () => {
            try {
              await archiveHabit(form.id);
              closeForm();
            } catch (err) {
              Alert.alert(
                'Could not archive habit',
                err instanceof Error ? err.message : 'Unknown error'
              );
            }
          },
        },
      ]
    );
  };

  const confirmDelete = (habitId, habitName, onDone) => {
    Alert.alert(
      `Delete “${habitName}” permanently?`,
      'This removes the habit and every check-in logged against it. It cannot be undone — archive it instead if you might come back to it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteHabit(habitId);
              if (onDone) onDone();
            } catch (err) {
              Alert.alert(
                'Could not delete habit',
                err instanceof Error ? err.message : 'Unknown error'
              );
            }
          },
        },
      ]
    );
  };

  const restore = async (habitId) => {
    try {
      await restoreHabit(habitId);
    } catch (err) {
      Alert.alert('Could not restore habit', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.container, { paddingBottom: spacing.xl + insets.bottom }]}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>Habits</Text>
          <View style={styles.titleActions}>
            <Pressable
              style={styles.iconButton}
              onPress={() => setShowCalendar(true)}
              accessibilityRole="button"
              accessibilityLabel="Open habit calendar"
            >
              <MaterialCommunityIcons name="calendar-month-outline" size={22} color={colors.accent} />
            </Pressable>
            <Pressable
              style={styles.addButton}
              onPress={() => (showForm ? closeForm() : openCreate())}
            >
              <Text style={styles.addButtonText}>{showForm ? 'Cancel' : '+ New'}</Text>
            </Pressable>
          </View>
        </View>

        <CalendarModal
          visible={showCalendar}
          habits={habits}
          onClose={() => setShowCalendar(false)}
        />

        {showForm ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{isEditing ? 'Edit habit' : 'New habit'}</Text>

            <Text style={styles.label}>Habit name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Morning walk"
              placeholderTextColor={colors.textMuted}
              value={form.name}
              onChangeText={(value) => setForm({ ...form, name: value })}
            />

            <Text style={styles.label}>Category</Text>
            <Dropdown
              value={form.category}
              options={HABIT_CATEGORY_OPTIONS}
              placeholder="Choose a category"
              onChange={(value) => setForm({ ...form, category: value })}
            />

            <Text style={styles.label}>How do you check in?</Text>
            <View style={styles.modeRow}>
              <Pressable
                style={[styles.modePill, form.trackingMode === 'BOOLEAN' && styles.modePillActive]}
                onPress={() => setForm({ ...form, trackingMode: 'BOOLEAN' })}
              >
                <Text
                  style={[
                    styles.modePillText,
                    form.trackingMode === 'BOOLEAN' && styles.modePillTextActive,
                  ]}
                >
                  Once a day
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modePill, form.trackingMode === 'COUNT' && styles.modePillActive]}
                onPress={() => setForm({ ...form, trackingMode: 'COUNT' })}
              >
                <Text
                  style={[
                    styles.modePillText,
                    form.trackingMode === 'COUNT' && styles.modePillTextActive,
                  ]}
                >
                  Count multiple
                </Text>
              </Pressable>
            </View>
            <Text style={styles.targetHint}>
              {form.trackingMode === 'COUNT'
                ? 'Log it as many times as you like each day — e.g. two gym visits, five job applications. Your targets below add up across every check-in.'
                : 'One check-in a day, on or off — right for habits like "meditate" or "read".'}
            </Text>

            <Text style={styles.sectionDivider}>Goals (optional)</Text>
            <Text style={styles.goalsHint}>
              Set targets at any scale — leave blank if you don't need that level.
            </Text>

            <View style={styles.targetRow}>
              <View style={styles.targetField}>
                <Text style={styles.label}>Times per day</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  placeholder="e.g. 8"
                  placeholderTextColor={colors.textMuted}
                  value={form.dailyTarget}
                  onChangeText={(v) => setForm({ ...form, dailyTarget: v.replace(/[^0-9]/g, '') })}
                />
                <Text style={styles.targetHint}>e.g. drink water 8× a day</Text>
              </View>
              <View style={styles.targetField}>
                <Text style={styles.label}>Times per week</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  placeholder="e.g. 3"
                  placeholderTextColor={colors.textMuted}
                  value={form.weeklyTarget}
                  onChangeText={(v) => setForm({ ...form, weeklyTarget: v.replace(/[^0-9]/g, '') })}
                />
                <Text style={styles.targetHint}>e.g. gym 3× a week</Text>
              </View>
            </View>

            <Text style={styles.label}>Times per month</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              placeholder="e.g. 50"
              placeholderTextColor={colors.textMuted}
              value={form.monthlyTarget}
              onChangeText={(v) => setForm({ ...form, monthlyTarget: v.replace(/[^0-9]/g, '') })}
            />
            <Text style={styles.targetHint}>e.g. apply for 50 jobs this month</Text>

            <Text style={styles.label}>Ideal time (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 8:00 AM"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              value={form.scheduledTime}
              onChangeText={(value) => setForm({ ...form, scheduledTime: value })}
            />

            <View style={styles.switchRow}>
              <View style={styles.switchText}>
                <Text style={styles.switchLabel}>Remind me at that time</Text>
                <Text style={styles.switchHint}>
                  {form.scheduledTime.trim()
                    ? 'Saved with the habit. Reminders start sending once notifications ship.'
                    : 'Set an ideal time first to turn this on.'}
                </Text>
              </View>
              <Switch
                value={Boolean(form.scheduledTime.trim()) && form.reminderEnabled}
                disabled={!form.scheduledTime.trim()}
                onValueChange={(value) => setForm({ ...form, reminderEnabled: value })}
                trackColor={{ false: colors.border, true: colors.safeSoft }}
                thumbColor={form.reminderEnabled ? colors.safe : '#FFFFFF'}
              />
            </View>

            <Pressable style={styles.primaryButton} onPress={submit} disabled={busy}>
              <Text style={styles.primaryButtonText}>
                {busy ? 'Saving…' : isEditing ? 'Save changes' : 'Add habit'}
              </Text>
            </Pressable>

            {isEditing ? (
              <View>
                <Pressable style={styles.secondaryButton} onPress={confirmArchive} disabled={busy}>
                  <Text style={styles.secondaryButtonText}>Archive habit</Text>
                </Pressable>

                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => confirmDelete(form.id, form.name.trim() || 'this habit', closeForm)}
                  disabled={busy}
                >
                  <Text style={styles.destructiveButtonText}>Delete permanently</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        {[
          {
            key: 'DAILY',
            label: 'Daily',
            // Only habits with a real daily target — a weekly/monthly-only
            // habit isn't "daily" just because it can be logged any day.
            match: (habit) => hasDailyTarget(habit),
          },
          {
            key: 'WEEKLY',
            label: 'Weekly',
            match: (habit) => !hasDailyTarget(habit) && effectiveWeeklyTarget(habit) > 0,
          },
          {
            key: 'MONTHLY',
            label: 'Monthly',
            // Monthly-only: no daily target and no weekly target, just a monthly one.
            match: (habit) =>
              !hasDailyTarget(habit) &&
              effectiveWeeklyTarget(habit) === 0 &&
              effectiveMonthlyTarget(habit) > 0,
          },
        ].map((section) => {
          const group = habits.filter(section.match);
          if (group.length === 0) return null;

          return (
            <View key={section.key} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.label}</Text>
              {group.map((habit) => (
                <HabitCard
                  key={habit.id}
                  name={habit.name}
                  category={habit.category}
                  cadenceType={habit.cadenceType}
                  trackingMode={habit.trackingMode}
                  todayCount={habit.todayCount}
                  scheduledTime={habit.scheduledTime}
                  reminderEnabled={habit.reminderEnabled}
                  progressLabel={habit.progressLabel}
                  progressLines={habit.progressLines || []}
                  progressComplete={habit.periodComplete}
                  streak={habit.streak}
                  streakStatus={habit.streakStatus}
                  checked={habit.checkedInToday}
                  disabled={busy}
                  onToggle={() => toggleCheckIn(habit.id)}
                  onAdd={() => addCheckIn(habit.id)}
                  onRemoveLast={() => removeLastCheckIn(habit.id)}
                  onEdit={() => openEdit(habit)}
                />
              ))}
            </View>
          );
        })}

        {habits.length === 0 && !showForm ? (
          <Text style={styles.empty}>No habits yet. Tap “+ New” to add your first one.</Text>
        ) : null}

        {archivedHabits.length > 0 ? (
          <View style={styles.section}>
            <Pressable
              style={styles.archivedHeader}
              onPress={() => setShowArchived((value) => !value)}
            >
              <Text style={styles.sectionTitle}>Archived ({archivedHabits.length})</Text>
              <Text style={styles.archivedToggle}>{showArchived ? 'Hide' : 'Show'}</Text>
            </Pressable>

            {showArchived
              ? archivedHabits.map((habit) => (
                  <View key={habit.id} style={styles.archivedRow}>
                    <View style={styles.archivedMain}>
                      <Text style={styles.archivedName} numberOfLines={1}>
                        {habit.name}
                      </Text>
                      <Text style={styles.archivedMeta}>
                        {habit.category} · check-ins kept
                      </Text>
                    </View>

                    <Pressable
                      style={styles.archivedAction}
                      onPress={() => restore(habit.id)}
                      disabled={busy}
                    >
                      <Text style={styles.archivedActionText}>Restore</Text>
                    </Pressable>

                    <Pressable
                      style={styles.archivedAction}
                      onPress={() => confirmDelete(habit.id, habit.name)}
                      disabled={busy}
                    >
                      <Text style={styles.destructiveButtonText}>Delete</Text>
                    </Pressable>
                  </View>
                ))
              : null}
          </View>
        ) : null}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.xl },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  titleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: typography.screenTitle,
  addButton: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  addButtonText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...shadow,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    marginBottom: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
  },
  label: { ...typography.meta, fontWeight: '600', marginBottom: spacing.sm },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  switchText: { flex: 1 },
  switchLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  switchHint: { ...typography.meta, marginTop: 2 },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  formTitle: { ...typography.sectionTitle, marginBottom: spacing.md },
  sectionDivider: {
    ...typography.sectionTitle,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  goalsHint: {
    ...typography.meta,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  modePill: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  modePillActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  modePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modePillTextActive: {
    color: colors.accent,
  },
  targetRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  targetField: {
    flex: 1,
  },
  targetHint: {
    ...typography.meta,
    color: colors.textMuted,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  secondaryButton: {
    borderRadius: radii.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  secondaryButtonText: { color: colors.textSecondary, fontWeight: '600', fontSize: 14 },
  destructiveButtonText: { color: colors.atRisk, fontWeight: '600', fontSize: 14 },
  archivedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  archivedToggle: { ...typography.meta, color: colors.accent, fontWeight: '700' },
  archivedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  archivedMain: { flex: 1 },
  archivedName: { ...typography.body, fontWeight: '600', color: colors.textSecondary },
  archivedMeta: { ...typography.meta, color: colors.textMuted, marginTop: 2 },
  archivedAction: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  archivedActionText: { color: colors.accent, fontWeight: '700', fontSize: 14 },
  section: { marginBottom: spacing.lg },
  sectionTitle: { ...typography.sectionTitle, marginBottom: spacing.md },
  empty: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
