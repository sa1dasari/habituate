import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { useGroups } from '../hooks/useGroups';
import { useHabits } from '../hooks/useHabits';
import { radii, spacing } from '../theme';

const RULE_OPTIONS = [
  { value: 'ANY_MEMBER', label: 'Any member' },
  { value: 'ALL_MEMBERS', label: 'All members' },
];

/** Dedicated create flow, reached only via a "+ Create" affordance — never via See all. */
export default function CreateGroupModal({ visible, onClose }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { busy, createGroup } = useGroups();
  const { habits } = useHabits();

  const [groupName, setGroupName] = useState('');
  const [selectedHabitId, setSelectedHabitId] = useState(null);
  const [rule, setRule] = useState('ANY_MEMBER');

  const reset = () => {
    setGroupName('');
    setSelectedHabitId(null);
    setRule('ANY_MEMBER');
  };

  const handleCreate = async () => {
    if (!selectedHabitId) {
      Alert.alert('Pick a habit', 'Choose which of your habits this shared habit tracks.');
      return;
    }
    const habit = habits.find((h) => h.id === selectedHabitId);
    const name = groupName.trim() || (habit ? habit.name : 'Shared Habit');
    const ok = await createGroup({ name, habitId: selectedHabitId, streakRule: rule });
    if (ok) {
      reset();
      onClose();
    } else {
      Alert.alert("Couldn't create shared habit", 'Something went wrong — try again.');
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={handleClose} hitSlop={12} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle}>Create a Shared Habit</Text>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.helperText}>
            Pick one of your own habits — friends you invite will link their own habit to the same group.
          </Text>

          {habits.length === 0 ? (
            <Text style={styles.emptyNote}>Create a habit first on the Habits tab.</Text>
          ) : (
            habits.map((habit) => (
              <Pressable key={habit.id} style={styles.habitRow} onPress={() => setSelectedHabitId(habit.id)}>
                <MaterialCommunityIcons
                  name={selectedHabitId === habit.id ? 'radiobox-marked' : 'radiobox-blank'}
                  size={18}
                  color={selectedHabitId === habit.id ? colors.accent : colors.textMuted}
                />
                <Text style={styles.habitRowText}>{habit.name}</Text>
              </Pressable>
            ))
          )}

          <TextInput
            style={styles.input}
            placeholder="Name (optional)"
            placeholderTextColor={colors.textMuted}
            value={groupName}
            onChangeText={setGroupName}
          />

          <View style={styles.ruleRow}>
            {RULE_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                style={[styles.ruleOption, rule === option.value && styles.ruleOptionActive]}
                onPress={() => setRule(option.value)}
              >
                <Text style={[styles.ruleOptionText, rule === option.value && styles.ruleOptionTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.primaryButton, styles.fullWidthButton]}
            disabled={busy || !selectedHabitId}
            onPress={handleCreate}
          >
            <Text style={styles.primaryButtonText}>Create</Text>
          </Pressable>
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
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { ...typography.sectionTitle },
    closeBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
    helperText: { ...typography.meta, marginBottom: spacing.md },
    emptyNote: { ...typography.meta, marginBottom: spacing.sm },
    habitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    habitRowText: { fontSize: 14, color: colors.textPrimary },
    input: {
      backgroundColor: colors.background,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      fontSize: 14,
      color: colors.textPrimary,
      marginTop: spacing.sm,
    },
    ruleRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    ruleOption: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: colors.background,
    },
    ruleOptionActive: { backgroundColor: colors.accentSoft },
    ruleOptionText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    ruleOptionTextActive: { color: colors.accent },
    fullWidthButton: { marginTop: spacing.lg, alignSelf: 'stretch', alignItems: 'center' },
    primaryButton: {
      backgroundColor: colors.accent,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    primaryButtonText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  });
}
