import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import HabitCard from '../components/HabitCard';
import { useHabits } from '../hooks/useHabits';
import { colors, radii, shadow, spacing, typography } from '../theme';

const CADENCES = [
  { key: 'DAILY', label: 'Daily' },
  { key: 'WEEKLY', label: 'Weekly' },
  { key: 'MONTHLY', label: 'Monthly' },
];

const emptyForm = { name: '', category: 'Health', cadenceType: 'DAILY', cadenceTarget: '1' };

export default function HabitsScreen() {
  const insets = useSafeAreaInsets();
  const { habits, busy, toggleCheckIn, createHabit } = useHabits();
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  const submit = async () => {
    const name = form.name.trim();
    if (!name) {
      Alert.alert('Missing habit name', 'Give the habit a name first.');
      return;
    }

    try {
      await createHabit({
        name,
        category: form.category.trim() || 'General',
        cadenceType: form.cadenceType,
        cadenceTarget: Number(form.cadenceTarget) || 1,
      });
      setForm(emptyForm);
      setShowForm(false);
    } catch (err) {
      Alert.alert('Could not create habit', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: spacing.xl + insets.bottom }]}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Habits</Text>
          <Pressable style={styles.addButton} onPress={() => setShowForm((value) => !value)}>
            <Text style={styles.addButtonText}>{showForm ? 'Cancel' : '+ New'}</Text>
          </Pressable>
        </View>

        {showForm ? (
          <View style={styles.formCard}>
            <TextInput
              style={styles.input}
              placeholder="Habit name"
              placeholderTextColor={colors.textMuted}
              value={form.name}
              onChangeText={(value) => setForm({ ...form, name: value })}
            />

            <TextInput
              style={styles.input}
              placeholder="Category"
              placeholderTextColor={colors.textMuted}
              value={form.category}
              onChangeText={(value) => setForm({ ...form, category: value })}
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
              <Text style={styles.primaryButtonText}>{busy ? 'Saving…' : 'Add habit'}</Text>
            </Pressable>
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
                />
              ))}
            </View>
          );
        })}

        {habits.length === 0 && !showForm ? (
          <Text style={styles.empty}>No habits yet. Tap “+ New” to add your first one.</Text>
        ) : null}

        <Text style={styles.pending}>
          Calendar grid view and edit/archive flows land with Phase 2.
        </Text>
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
