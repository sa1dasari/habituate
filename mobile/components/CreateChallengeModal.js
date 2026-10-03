import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import NumberStepper from './NumberStepper';
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

/** Dedicated create flow, reached only via a "+ Create" affordance — never via Browse. */
export default function CreateChallengeModal({ visible, onClose }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { busy, createChallenge } = useChallenges();

  const [name, setName] = useState('');
  const [targetCount, setTargetCount] = useState(5);
  const [lengthDays, setLengthDays] = useState(7);
  const [visibility, setVisibility] = useState('PRIVATE');

  const periodEndPreview = toDateKey(new Date(Date.now() + lengthDays * 24 * 60 * 60 * 1000));

  const reset = () => {
    setName('');
    setTargetCount(5);
    setLengthDays(7);
    setVisibility('PRIVATE');
  };

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name it', 'Give the challenge a name.');
      return;
    }
    const ok = await createChallenge({
      name: trimmedName,
      targetCount,
      periodStart: toDateKey(new Date()),
      periodEnd: periodEndPreview,
      visibility,
    });
    if (ok) {
      reset();
      onClose();
    } else {
      Alert.alert("Couldn't create challenge", 'Something went wrong — try again.');
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
          <Text style={styles.headerTitle}>Create a Challenge</Text>
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

          <View style={styles.row}>
            <Text style={styles.inputLabel}>Target (days to hit)</Text>
            <NumberStepper value={targetCount} onChange={setTargetCount} min={1} max={MAX_TARGET_DAYS} label="target days" />
          </View>

          <Text style={styles.fieldLabel}>Length</Text>
          <View style={styles.presetRow}>
            {LENGTH_PRESETS.map((preset) => (
              <Pressable
                key={preset.days}
                style={[styles.presetChip, lengthDays === preset.days && styles.presetChipActive]}
                onPress={() => setLengthDays(preset.days)}
              >
                <Text style={[styles.presetChipText, lengthDays === preset.days && styles.presetChipTextActive]}>
                  {preset.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.row}>
            <Text style={styles.inputLabel}>Fine-tune (days, max {MAX_LENGTH_DAYS})</Text>
            <NumberStepper value={lengthDays} onChange={setLengthDays} min={1} max={MAX_LENGTH_DAYS} label="length in days" />
          </View>

          <Text style={styles.previewNote}>
            {lengthDays} day{lengthDays === 1 ? '' : 's'} · ends {periodEndPreview}
          </Text>

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
            <Text style={styles.primaryButtonText}>Create & join</Text>
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
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
    inputLabel: { fontSize: 14, color: colors.textSecondary, flexShrink: 1 },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm },
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
