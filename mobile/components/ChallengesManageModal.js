import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AvatarStack from './AvatarStack';
import { useAppTheme } from '../hooks/useAppTheme';
import { useChallenges } from '../hooks/useChallenges';
import { toDateKey } from '../utils/date';
import { radii, shadow, spacing } from '../theme';

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

function Stepper({ value, onChange, min, max, step = 1, styles, colors, label }) {
  return (
    <View style={styles.stepper}>
      <Pressable
        style={[styles.stepperBtn, value <= min && styles.stepperBtnDisabled]}
        disabled={value <= min}
        hitSlop={8}
        accessibilityLabel={`Decrease ${label}`}
        onPress={() => onChange(Math.max(min, value - step))}
      >
        <MaterialCommunityIcons name="minus" size={18} color={colors.textSecondary} />
      </Pressable>
      <Text style={styles.stepperValue}>{value}</Text>
      <Pressable
        style={[styles.stepperBtn, styles.stepperBtnAdd, value >= max && styles.stepperBtnDisabled]}
        disabled={value >= max}
        hitSlop={8}
        accessibilityLabel={`Increase ${label}`}
        onPress={() => onChange(Math.min(max, value + step))}
      >
        <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

/** Full-page modal for the Challenges "Browse": join public challenges, or create a new one. */
export default function ChallengesManageModal({ visible, onClose }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { browseList, busy, createChallenge, joinChallenge } = useChallenges();

  const [name, setName] = useState('');
  const [targetCount, setTargetCount] = useState(5);
  const [lengthDays, setLengthDays] = useState(7);
  const [visibility, setVisibility] = useState('PRIVATE');

  const periodEndPreview = toDateKey(new Date(Date.now() + lengthDays * 24 * 60 * 60 * 1000));

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name it', 'Give the challenge a name.');
      return;
    }
    const periodStart = toDateKey(new Date());
    const periodEnd = periodEndPreview;

    const ok = await createChallenge({
      name: trimmedName,
      targetCount,
      periodStart,
      periodEnd,
      visibility,
    });
    if (ok) {
      setName('');
      setTargetCount(5);
      setLengthDays(7);
      setVisibility('PRIVATE');
    } else {
      Alert.alert("Couldn't create challenge", 'Something went wrong — try again.');
    }
  };

  const handleJoin = async (challengeId) => {
    const ok = await joinChallenge(challengeId);
    if (!ok) Alert.alert("Couldn't join", 'Something went wrong — try again.');
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle}>Challenges</Text>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Create a challenge</Text>

            <TextInput
              style={styles.input}
              placeholder="Challenge name"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
            />

            <View style={styles.row}>
              <Text style={styles.inputLabel}>Target (days to hit)</Text>
              <Stepper
                value={targetCount}
                onChange={setTargetCount}
                min={1}
                max={MAX_TARGET_DAYS}
                styles={styles}
                colors={colors}
                label="target days"
              />
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
              <Stepper
                value={lengthDays}
                onChange={setLengthDays}
                min={1}
                max={MAX_LENGTH_DAYS}
                styles={styles}
                colors={colors}
                label="length in days"
              />
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
                    style={[
                      styles.visibilityOptionText,
                      visibility === option.value && styles.visibilityOptionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.primaryButton} disabled={busy} onPress={handleCreate}>
              <Text style={styles.primaryButtonText}>Create & join</Text>
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Public challenges</Text>

            {browseList.length === 0 ? (
              <Text style={styles.emptyNote}>No public challenges right now — create one above.</Text>
            ) : (
              browseList.map((challenge) => (
                <View key={challenge.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {challenge.name}
                    </Text>
                    {!challenge.joined ? (
                      <Pressable
                        style={styles.primaryButtonSmall}
                        disabled={busy}
                        onPress={() => handleJoin(challenge.id)}
                      >
                        <Text style={styles.primaryButtonText}>Join</Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.joinedLabel}>Joined</Text>
                    )}
                  </View>
                  <Text style={styles.cardMeta}>
                    Target {challenge.targetCount} days · ends {challenge.periodEnd}
                  </Text>
                  <AvatarStack
                    people={challenge.participants}
                    total={challenge.participantCount}
                    size={22}
                  />
                </View>
              ))
            )}
          </View>
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
    section: { marginBottom: spacing.xl },
    sectionTitle: { ...typography.sectionTitle, marginBottom: spacing.md },
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
    stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    stepperBtn: {
      width: 36,
      height: 36,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    stepperBtnAdd: { backgroundColor: colors.accent },
    stepperBtnDisabled: { opacity: 0.4 },
    stepperValue: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textPrimary,
      minWidth: 32,
      textAlign: 'center',
    },
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
    primaryButtonSmall: {
      backgroundColor: colors.accent,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    primaryButtonText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
    emptyNote: { ...typography.meta },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      ...shadow,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    cardName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
    cardMeta: { ...typography.meta, marginTop: 2, marginBottom: spacing.md },
    joinedLabel: { fontSize: 12, fontWeight: '700', color: colors.safe },
  });
}
