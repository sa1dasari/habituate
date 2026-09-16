import React, { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Dropdown from '../components/Dropdown';
import HabitCard from '../components/HabitCard';
import {
  DEFAULT_HABIT_CATEGORY,
  HABIT_CATEGORY_OPTIONS,
} from '../constants/habitCategories';
import { useHabits } from '../hooks/useHabits';
import { colors, radii, shadow, spacing, typography } from '../theme';

const CADENCES = [
  { key: 'DAILY', label: 'Daily' },
  { key: 'WEEKLY', label: 'Weekly' },
  { key: 'MONTHLY', label: 'Monthly' },
];

const emptyForm = {
  id: null,
  name: '',
  category: DEFAULT_HABIT_CATEGORY,
  cadenceType: 'DAILY',
  cadenceTarget: '1',
};

function formFromHabit(habit) {
  const cadenceType = String(habit.cadenceType || 'DAILY').toUpperCase();
  return {
    id: habit.id,
    name: habit.name || '',
    category: HABIT_CATEGORY_OPTIONS.some((option) => option.value === habit.category)
      ? habit.category
      : DEFAULT_HABIT_CATEGORY,
    cadenceType: CADENCES.some((cadence) => cadence.key === cadenceType) ? cadenceType : 'DAILY',
    cadenceTarget: String(habit.cadenceTarget == null ? 1 : habit.cadenceTarget),
  };
}

export default function HabitsScreen() {
  const insets = useSafeAreaInsets();
  const {
    habits,
    archivedHabits,
    busy,
    toggleCheckIn,
    createHabit,
    updateHabit,
    archiveHabit,
    restoreHabit,
    deleteHabit,
  } = useHabits();
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
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

    const payload = {
      name,
      category: form.category || DEFAULT_HABIT_CATEGORY,
      cadenceType: form.cadenceType,
      cadenceTarget: Number(form.cadenceTarget) || 1,
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
          <Pressable
            style={styles.addButton}
            onPress={() => (showForm ? closeForm() : openCreate())}
          >
            <Text style={styles.addButtonText}>{showForm ? 'Cancel' : '+ New'}</Text>
          </Pressable>
        </View>

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

            <Text style={styles.label}>Cadence</Text>
            <View style={styles.segmented}>
              {CADENCES.map((cadence) => {
                const active = form.cadenceType === cadence.key;
                return (
                  <Pressable
                    key={cadence.key}
                    style={[styles.segment, active && styles.segmentActive]}
                    onPress={() => setForm({ ...form, cadenceType: cadence.key })}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {cadence.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Target per period</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={form.cadenceTarget}
              onChangeText={(value) => setForm({ ...form, cadenceTarget: value.replace(/[^0-9]/g, '') })}
            />

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

        {CADENCES.map((cadence) => {
          const group = habits.filter(
            (habit) => String(habit.cadenceType).toUpperCase() === cadence.key
          );
          if (group.length === 0) return null;

          return (
            <View key={cadence.key} style={styles.section}>
              <Text style={styles.sectionTitle}>{cadence.label}</Text>
              {group.map((habit) => (
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

        <Text style={styles.pending}>Calendar grid view lands with Phase 2.</Text>
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
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radii.sm,
    padding: 3,
    marginBottom: spacing.md,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.sm - 2,
  },
  segmentActive: { backgroundColor: colors.surface, ...shadow },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  segmentTextActive: { color: colors.textPrimary },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  formTitle: { ...typography.sectionTitle, marginBottom: spacing.md },
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
  pending: {
    ...typography.meta,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
