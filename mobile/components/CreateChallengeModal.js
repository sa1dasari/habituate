import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import NumberStepper from './NumberStepper';
import TimePicker from './TimePicker';
import { useAppTheme } from '../hooks/useAppTheme';
import { useChallenges } from '../hooks/useChallenges';
import { toDateKey } from '../utils/date';
import { radii, spacing } from '../theme';

const MAX_LENGTH_DAYS = 365;
const MAX_TARGET_DAYS = 365;

const LENGTH_PRESETS = [
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
  { label: '6 months', days: 180 },
  { label: '1 year', days: 365 },
];

const VISIBILITY_OPTIONS = [
  { value: 'PRIVATE', label: 'Private', icon: 'lock-outline' },
  { value: 'PUBLIC', label: 'Public', icon: 'earth' },
];

const TRACKING_MODE_OPTIONS = [
  { value: 'BOOLEAN', label: 'Check-off', icon: 'check-circle-outline' },
  { value: 'COUNT', label: 'Quantitative', icon: 'counter' },
];

const CADENCE_OPTIONS = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY_QUOTA', label: 'Weekly quota' },
  { value: 'CUSTOM_DAYS', label: 'Custom days' },
];

const WEEKDAYS = [
  { value: 1, label: 'M' },
  { value: 2, label: 'T' },
  { value: 3, label: 'W' },
  { value: 4, label: 'T' },
  { value: 5, label: 'F' },
  { value: 6, label: 'S' },
  { value: 7, label: 'S' },
];

const ICON_OPTIONS = [
  'trophy-outline', 'run', 'water', 'book-open-outline', 'dumbbell', 'food-apple-outline', 'meditation', 'star-outline',
];

const COLOR_OPTIONS = ['#2563EB', '#7C3AED', '#0891B2', '#DB2777', '#EA580C', '#16A34A', '#CA8A04', '#64748B'];

function daysBetween(fromKey, toKey) {
  const from = new Date(fromKey);
  const to = new Date(toKey);
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));
}

/** Dedicated create/edit flow. Pass `challenge` to edit an existing one (reached from its
 * detail modal, creator-only) — omit it for the "+ Create" flow, never reached via Browse. */
export default function CreateChallengeModal({ visible, onClose, challenge = null }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { busy, createChallenge: createChallengeAction, updateChallenge } = useChallenges();
  const isEditing = !!challenge;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState(ICON_OPTIONS[0]);
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [trackingMode, setTrackingMode] = useState('BOOLEAN');
  const [targetCount, setTargetCount] = useState(5);
  const [lengthDays, setLengthDays] = useState(7);
  const [openEnded, setOpenEnded] = useState(false);
  const [visibility, setVisibility] = useState('PRIVATE');
  const [cadenceType, setCadenceType] = useState('DAILY');
  const [weeklyQuota, setWeeklyQuota] = useState(3);
  const [customDays, setCustomDays] = useState([1, 3, 5]);
  const [reminderTime, setReminderTime] = useState('');

  // periodEnd is computed relative to the challenge's own (fixed) periodStart when editing,
  // not "today" — otherwise saving an edit would silently shift the whole challenge forward.
  const basePeriodStart = isEditing ? challenge.periodStart : toDateKey(new Date());
  const periodEndPreview = toDateKey(new Date(new Date(basePeriodStart).getTime() + lengthDays * 24 * 60 * 60 * 1000));

  const reset = () => {
    setName('');
    setDescription('');
    setIcon(ICON_OPTIONS[0]);
    setColor(COLOR_OPTIONS[0]);
    setTrackingMode('BOOLEAN');
    setTargetCount(5);
    setLengthDays(7);
    setOpenEnded(false);
    setVisibility('PRIVATE');
    setCadenceType('DAILY');
    setWeeklyQuota(3);
    setCustomDays([1, 3, 5]);
    setReminderTime('');
  };

  useEffect(() => {
    if (!visible) return;
    if (!challenge) {
      reset();
      return;
    }
    setName(challenge.name || '');
    setDescription(challenge.description || '');
    setIcon(challenge.icon || ICON_OPTIONS[0]);
    setColor(challenge.color || COLOR_OPTIONS[0]);
    setTrackingMode(challenge.trackingMode || 'BOOLEAN');
    setTargetCount(challenge.targetCount || 5);
    setOpenEnded(!challenge.periodEnd);
    setLengthDays(challenge.periodEnd ? daysBetween(challenge.periodStart, challenge.periodEnd) : 7);
    setVisibility(challenge.visibility || 'PRIVATE');
    setCadenceType(challenge.cadenceType || 'DAILY');
    setWeeklyQuota(challenge.weeklyQuota || 3);
    setCustomDays(challenge.customDays ? challenge.customDays.split(',').map(Number) : [1, 3, 5]);
    setReminderTime(challenge.reminderTime || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, challenge]);

  const toggleCustomDay = (day) => {
    setCustomDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  };

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name it', 'Give the challenge a name.');
      return;
    }
    if (cadenceType === 'CUSTOM_DAYS' && customDays.length === 0) {
      Alert.alert('Pick some days', 'Choose at least one day for a custom-days cadence.');
      return;
    }
    const payload = {
      name: trimmedName,
      description: description.trim() || null,
      icon,
      color,
      trackingMode,
      targetCount,
      periodStart: basePeriodStart,
      periodEnd: openEnded ? null : periodEndPreview,
      visibility,
      cadenceType,
      weeklyQuota: cadenceType === 'WEEKLY_QUOTA' ? weeklyQuota : null,
      customDays: cadenceType === 'CUSTOM_DAYS' ? customDays.join(',') : null,
      reminderTime: reminderTime || null,
    };
    const ok = isEditing ? await updateChallenge(challenge.id, payload) : await createChallengeAction(payload);
    if (ok) {
      reset();
      onClose();
    } else {
      Alert.alert(isEditing ? "Couldn't save changes" : "Couldn't create challenge", 'Something went wrong — try again.');
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
          <Text style={styles.headerTitle}>{isEditing ? 'Edit Challenge' : 'Create a Challenge'}</Text>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <TextInput
            style={styles.input}
            placeholder="Challenge name"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Description / rules of engagement (optional)"
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <Text style={styles.fieldLabel}>Icon</Text>
          <View style={styles.iconRow}>
            {ICON_OPTIONS.map((option) => (
              <Pressable
                key={option}
                style={[styles.iconSwatch, icon === option && { borderColor: color }]}
                onPress={() => setIcon(option)}
              >
                <MaterialCommunityIcons name={option} size={18} color={icon === option ? color : colors.textSecondary} />
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Color</Text>
          <View style={styles.iconRow}>
            {COLOR_OPTIONS.map((option) => (
              <Pressable
                key={option}
                style={[styles.colorSwatch, { backgroundColor: option }, color === option && styles.colorSwatchActive]}
                onPress={() => setColor(option)}
              />
            ))}
          </View>

          <Text style={styles.fieldLabel}>Log style{isEditing ? ' (fixed after creation)' : ''}</Text>
          <View style={styles.visibilityRow}>
            {TRACKING_MODE_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.visibilityOption,
                  trackingMode === option.value && styles.visibilityOptionActive,
                  isEditing && styles.visibilityOptionDisabled,
                ]}
                disabled={isEditing}
                onPress={() => setTrackingMode(option.value)}
              >
                <MaterialCommunityIcons
                  name={option.icon}
                  size={14}
                  color={trackingMode === option.value ? colors.accent : colors.textSecondary}
                />
                <Text
                  style={[styles.visibilityOptionText, trackingMode === option.value && styles.visibilityOptionTextActive]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.row}>
            <Text style={styles.inputLabel}>
              {trackingMode === 'COUNT' ? 'Target (total amount)' : 'Target (days to hit)'}
            </Text>
            <NumberStepper value={targetCount} onChange={setTargetCount} min={1} max={MAX_TARGET_DAYS} label="target" />
          </View>

          <Text style={styles.fieldLabel}>Frequency cadence</Text>
          <View style={styles.presetRow}>
            {CADENCE_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                style={[styles.presetChip, cadenceType === option.value && styles.presetChipActive]}
                onPress={() => setCadenceType(option.value)}
              >
                <Text style={[styles.presetChipText, cadenceType === option.value && styles.presetChipTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {cadenceType === 'WEEKLY_QUOTA' ? (
            <View style={styles.row}>
              <Text style={styles.inputLabel}>Times a week</Text>
              <NumberStepper value={weeklyQuota} onChange={setWeeklyQuota} min={1} max={7} label="times a week" />
            </View>
          ) : null}

          {cadenceType === 'CUSTOM_DAYS' ? (
            <View style={styles.weekdayRow}>
              {WEEKDAYS.map((day) => (
                <Pressable
                  key={day.value}
                  style={[styles.weekdayChip, customDays.includes(day.value) && styles.weekdayChipActive]}
                  onPress={() => toggleCustomDay(day.value)}
                >
                  <Text
                    style={[styles.weekdayChipText, customDays.includes(day.value) && styles.weekdayChipTextActive]}
                  >
                    {day.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Text style={styles.fieldLabel}>Duration</Text>
          <View style={styles.presetRow}>
            {LENGTH_PRESETS.map((preset) => (
              <Pressable
                key={preset.days}
                disabled={openEnded}
                style={[styles.presetChip, !openEnded && lengthDays === preset.days && styles.presetChipActive]}
                onPress={() => setLengthDays(preset.days)}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    !openEnded && lengthDays === preset.days && styles.presetChipTextActive,
                  ]}
                >
                  {preset.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {!openEnded ? (
            <View style={styles.row}>
              <Text style={styles.inputLabel}>Fine-tune (days, max {MAX_LENGTH_DAYS})</Text>
              <NumberStepper value={lengthDays} onChange={setLengthDays} min={1} max={MAX_LENGTH_DAYS} label="length in days" />
            </View>
          ) : null}

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Open-ended (no end date)</Text>
            <Switch
              value={openEnded}
              onValueChange={setOpenEnded}
              trackColor={{ false: colors.border, true: colors.accentSoft }}
              thumbColor={openEnded ? colors.accent : '#FFFFFF'}
            />
          </View>

          <Text style={styles.previewNote}>
            {openEnded ? 'No fixed end date' : `${lengthDays} day${lengthDays === 1 ? '' : 's'} · ends ${periodEndPreview}`}
          </Text>

          <Text style={styles.fieldLabel}>Reminder (optional)</Text>
          <TimePicker value={reminderTime} onChange={setReminderTime} placeholder="Set a reminder time" />

          <Text style={styles.fieldLabel}>Visibility</Text>
          <View style={styles.visibilityRow}>
            {VISIBILITY_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                style={[styles.visibilityOption, visibility === option.value && styles.visibilityOptionActive]}
                onPress={() => setVisibility(option.value)}
              >
                <MaterialCommunityIcons
                  name={option.icon}
                  size={14}
                  color={visibility === option.value ? colors.accent : colors.textSecondary}
                />
                <Text
                  style={[styles.visibilityOptionText, visibility === option.value && styles.visibilityOptionTextActive]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.primaryButton} disabled={busy} onPress={handleCreate}>
            <Text style={styles.primaryButtonText}>{isEditing ? 'Save changes' : 'Create & join'}</Text>
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
    input: {
      backgroundColor: colors.background,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      fontSize: 14,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    multilineInput: { minHeight: 60, textAlignVertical: 'top' },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
    inputLabel: { fontSize: 14, color: colors.textSecondary, flexShrink: 1 },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm },
    iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
    iconSwatch: {
      width: 38,
      height: 38,
      borderRadius: radii.md,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    colorSwatch: {
      width: 28,
      height: 28,
      borderRadius: radii.pill,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    colorSwatchActive: { borderColor: colors.textPrimary },
    presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
    presetChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: colors.background,
    },
    presetChipActive: { backgroundColor: colors.accentSoft },
    presetChipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    presetChipTextActive: { color: colors.accent },
    weekdayRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
    weekdayChip: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: colors.background,
      alignItems: 'center',
    },
    weekdayChipActive: { backgroundColor: colors.accentSoft },
    weekdayChipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
    weekdayChipTextActive: { color: colors.accent },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    switchLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
    previewNote: { ...typography.meta, marginBottom: spacing.lg },
    visibilityRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    visibilityOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: colors.background,
    },
    visibilityOptionActive: { backgroundColor: colors.accentSoft },
    visibilityOptionDisabled: { opacity: 0.5 },
    visibilityOptionText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    visibilityOptionTextActive: { color: colors.accent },
    primaryButton: {
      backgroundColor: colors.accent,
      borderRadius: radii.pill,
      paddingVertical: spacing.sm + 2,
      alignItems: 'center',
    },
    primaryButtonText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  });
}
