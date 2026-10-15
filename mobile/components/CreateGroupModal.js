import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import NumberStepper from './NumberStepper';
import { useAppTheme } from '../hooks/useAppTheme';
import { useGroups } from '../hooks/useGroups';
import { useHabits } from '../hooks/useHabits';
import { radii, spacing } from '../theme';

const RULE_OPTIONS = [
  { value: 'ANY_MEMBER', label: 'Any member' },
  { value: 'ALL_MEMBERS', label: 'All members' },
];

const GOAL_ALIGNMENT_OPTIONS = [
  { value: 'UNIFIED', label: 'Unified goal', hint: 'Everyone aims for the same target' },
  { value: 'SPLIT', label: 'Split goal', hint: 'Each person tracks their own parallel goal' },
];

const TRACKING_MODE_OPTIONS = [
  { value: 'COOPERATIVE', label: 'Cooperative streak', hint: 'One shared streak — breaks for everyone if anyone misses' },
  { value: 'INDEPENDENT', label: 'Independent streaks', hint: "Everyone keeps their own streak, visible to each other" },
];

const VISIBILITY_OPTIONS = [
  { value: 'FULL_DETAILS', label: 'Full details', hint: 'Groupmates see your exact logged amount' },
  { value: 'STATUS_ONLY', label: 'Status only', hint: 'Groupmates only see completed / not' },
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
  const [goalAlignment, setGoalAlignment] = useState('UNIFIED');
  const [trackingMode, setTrackingMode] = useState('COOPERATIVE');
  const [visibilityLevel, setVisibilityLevel] = useState('FULL_DETAILS');
  const [nudgesEnabled, setNudgesEnabled] = useState(true);
  const [skipDaysPerMonth, setSkipDaysPerMonth] = useState(1);

  const reset = () => {
    setGroupName('');
    setSelectedHabitId(null);
    setRule('ANY_MEMBER');
    setGoalAlignment('UNIFIED');
    setTrackingMode('COOPERATIVE');
    setVisibilityLevel('FULL_DETAILS');
    setNudgesEnabled(true);
    setSkipDaysPerMonth(1);
  };

  const handleCreate = async () => {
    if (!selectedHabitId) {
      Alert.alert('Pick a habit', 'Choose which of your habits this shared habit tracks.');
      return;
    }
    const habit = habits.find((h) => h.id === selectedHabitId);
    const name = groupName.trim() || (habit ? habit.name : 'Shared Habit');
    const ok = await createGroup({
      name,
      habitId: selectedHabitId,
      streakRule: rule,
      goalAlignment,
      trackingMode,
      visibilityLevel,
      nudgesEnabled,
      skipDaysPerMonth,
    });
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

          <Text style={styles.fieldLabel}>Goal alignment</Text>
          {GOAL_ALIGNMENT_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              style={[styles.optionRow, goalAlignment === option.value && styles.optionRowActive]}
              onPress={() => setGoalAlignment(option.value)}
            >
              <MaterialCommunityIcons
                name={goalAlignment === option.value ? 'radiobox-marked' : 'radiobox-blank'}
                size={18}
                color={goalAlignment === option.value ? colors.accent : colors.textMuted}
              />
              <View style={styles.optionText}>
                <Text style={styles.optionLabel}>{option.label}</Text>
                <Text style={styles.optionHint}>{option.hint}</Text>
              </View>
            </Pressable>
          ))}

          <Text style={styles.fieldLabel}>Tracking mode</Text>
          {TRACKING_MODE_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              style={[styles.optionRow, trackingMode === option.value && styles.optionRowActive]}
              onPress={() => setTrackingMode(option.value)}
            >
              <MaterialCommunityIcons
                name={trackingMode === option.value ? 'radiobox-marked' : 'radiobox-blank'}
                size={18}
                color={trackingMode === option.value ? colors.accent : colors.textMuted}
              />
              <View style={styles.optionText}>
                <Text style={styles.optionLabel}>{option.label}</Text>
                <Text style={styles.optionHint}>{option.hint}</Text>
              </View>
            </Pressable>
          ))}

          {trackingMode === 'COOPERATIVE' ? (
            <>
              <Text style={styles.fieldLabel}>Streak rule</Text>
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

              <View style={styles.row}>
                <Text style={styles.inputLabel}>Skip days allowed a month</Text>
                <NumberStepper value={skipDaysPerMonth} onChange={setSkipDaysPerMonth} min={0} max={3} label="skip days" />
              </View>
            </>
          ) : null}

          <Text style={styles.fieldLabel}>Privacy & transparency</Text>
          {VISIBILITY_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              style={[styles.optionRow, visibilityLevel === option.value && styles.optionRowActive]}
              onPress={() => setVisibilityLevel(option.value)}
            >
              <MaterialCommunityIcons
                name={visibilityLevel === option.value ? 'radiobox-marked' : 'radiobox-blank'}
                size={18}
                color={visibilityLevel === option.value ? colors.accent : colors.textMuted}
              />
              <View style={styles.optionText}>
                <Text style={styles.optionLabel}>{option.label}</Text>
                <Text style={styles.optionHint}>{option.hint}</Text>
              </View>
            </Pressable>
          ))}

          <View style={styles.switchRow}>
            <View style={styles.optionText}>
              <Text style={styles.optionLabel}>Allow nudges</Text>
              <Text style={styles.optionHint}>Let groupmates send a reminder push if you haven't checked in</Text>
            </View>
            <Switch
              value={nudgesEnabled}
              onValueChange={setNudgesEnabled}
              trackColor={{ false: colors.border, true: colors.accentSoft }}
              thumbColor={nudgesEnabled ? colors.accent : '#FFFFFF'}
            />
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
      marginBottom: spacing.md,
    },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.sm },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.background,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      marginBottom: spacing.sm,
    },
    optionRowActive: { backgroundColor: colors.accentSoft },
    optionText: { flex: 1 },
    optionLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
    optionHint: { ...typography.meta, marginTop: 1 },
    ruleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
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
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
    inputLabel: { fontSize: 14, color: colors.textSecondary, flexShrink: 1 },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
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
