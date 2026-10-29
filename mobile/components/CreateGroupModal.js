import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ConfirmModal from './ConfirmModal';
import ScrubberInput from './ScrubberInput';
import Toast from './Toast';
import TourHighlight from './TourHighlight';
import { useAppTheme } from '../hooks/useAppTheme';
import { useConfirm } from '../hooks/useConfirm';
import { useGroups } from '../hooks/useGroups';
import { useHabits } from '../hooks/useHabits';
import { useToast } from '../hooks/useToast';
import { useTourTarget } from '../hooks/useTourTarget';
import { TOUR_SCOPES, TOUR_TARGETS } from '../constants/onboardingTour';
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

/** Dedicated create/edit flow. Pass `group` to edit an existing shared habit's settings
 * (reached from its detail modal, creator-only) — omit it for the "+ Create" flow. */
export default function CreateGroupModal({ visible, onClose, onDeleted, group = null }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { busy, createGroup, updateGroup, deleteGroup } = useGroups();
  const { habits } = useHabits();
  const isEditing = !!group;
  const tourHeaderRef = useTourTarget(TOUR_TARGETS.MODAL_CREATE_GROUP_HEADER);
  const { toast, showToast, hideToast } = useToast();
  const { request, confirm, respond } = useConfirm();

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete this shared habit?',
      message: `This deletes "${group?.name}" for every member, not just you — there's no undo.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteGroup(group.id);
      onDeleted ? onDeleted() : onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't delete — try again.", 'error');
    }
  };

  const [groupName, setGroupName] = useState('');
  const [selectedHabitId, setSelectedHabitId] = useState(null);
  const [rule, setRule] = useState('ANY_MEMBER');
  const [goalAlignment, setGoalAlignment] = useState('UNIFIED');
  const [trackingMode, setTrackingMode] = useState('COOPERATIVE');
  const [visibilityLevel, setVisibilityLevel] = useState('FULL_DETAILS');
  const [nudgesEnabled, setNudgesEnabled] = useState(true);
  const [skipDaysPerMonth, setSkipDaysPerMonth] = useState(1);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const reset = () => {
    setGroupName('');
    setSelectedHabitId(null);
    setRule('ANY_MEMBER');
    setGoalAlignment('UNIFIED');
    setTrackingMode('COOPERATIVE');
    setVisibilityLevel('FULL_DETAILS');
    setNudgesEnabled(true);
    setSkipDaysPerMonth(1);
    setAdvancedOpen(false);
  };

  useEffect(() => {
    if (!visible) return;
    if (!group) {
      reset();
      return;
    }
    setGroupName(group.name || '');
    setRule((group.rule || 'any_member').toUpperCase());
    setGoalAlignment(group.goalAlignment || 'UNIFIED');
    setTrackingMode(group.trackingMode || 'COOPERATIVE');
    setVisibilityLevel(group.visibilityLevel || 'FULL_DETAILS');
    setNudgesEnabled(group.nudgesEnabled !== false);
    setSkipDaysPerMonth(group.skipDaysPerMonth ?? 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, group]);

  const handleCreate = async () => {
    if (isEditing) {
      const trimmedName = groupName.trim();
      if (!trimmedName) {
        showToast('Give the shared habit a name.', 'error');
        return;
      }
      try {
        await updateGroup(group.id, {
          name: trimmedName,
          streakRule: rule,
          goalAlignment,
          trackingMode,
          visibilityLevel,
          nudgesEnabled,
          skipDaysPerMonth,
        });
        onClose();
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Couldn't save changes", 'error');
      }
      return;
    }

    if (!selectedHabitId) {
      showToast('Choose which of your habits this shared habit tracks.', 'error');
      return;
    }
    const habit = habits.find((h) => h.id === selectedHabitId);
    const name = groupName.trim() || (habit ? habit.name : 'Shared Habit');
    try {
      await createGroup({
        name,
        habitId: selectedHabitId,
        streakRule: rule,
        goalAlignment,
        trackingMode,
        visibilityLevel,
        nudgesEnabled,
        skipDaysPerMonth,
      });
      reset();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't create shared habit", 'error');
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header} ref={tourHeaderRef}>
          <Pressable onPress={handleClose} hitSlop={12} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle}>{isEditing ? 'Edit Shared Habit' : 'Create a Shared Habit'}</Text>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {isEditing ? null : (
            <>
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
            </>
          )}

          <TextInput
            style={styles.input}
            placeholder={isEditing ? 'Name' : 'Name (optional)'}
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
            </>
          ) : null}

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

          <Pressable style={styles.advancedToggle} onPress={() => setAdvancedOpen((v) => !v)}>
            <Text style={styles.advancedToggleText}>Advanced settings</Text>
            <MaterialCommunityIcons
              name={advancedOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textSecondary}
            />
          </Pressable>

          {advancedOpen ? (
            <View style={styles.advancedBody}>
              {trackingMode === 'COOPERATIVE' ? (
                <View style={styles.row}>
                  <Text style={styles.inputLabel}>Skip days allowed a month</Text>
                  <ScrubberInput value={skipDaysPerMonth} onChange={setSkipDaysPerMonth} min={0} max={3} label="skip days" />
                </View>
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
            </View>
          ) : null}

          <Pressable
            style={[styles.primaryButton, styles.fullWidthButton]}
            disabled={busy || (!isEditing && !selectedHabitId)}
            onPress={handleCreate}
          >
            <Text style={styles.primaryButtonText}>{isEditing ? 'Save changes' : 'Create'}</Text>
          </Pressable>

          {isEditing ? (
            <Pressable style={styles.deleteButton} disabled={busy} onPress={handleDelete}>
              <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.atRisk} />
              <Text style={styles.deleteButtonText}>Delete shared habit</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
      <TourHighlight scope={TOUR_SCOPES.CREATE_GROUP_MODAL} />
      <Toast toast={toast} onHide={hideToast} />
      <ConfirmModal request={request} onRespond={respond} />
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
    advancedToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm + 2,
      marginTop: spacing.sm,
    },
    advancedToggleText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
    advancedBody: { marginTop: spacing.xs },
    fullWidthButton: { marginTop: spacing.lg, alignSelf: 'stretch', alignItems: 'center' },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      marginTop: spacing.lg,
      paddingVertical: spacing.sm,
    },
    deleteButtonText: { fontSize: 13, fontWeight: '700', color: colors.atRisk },
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
