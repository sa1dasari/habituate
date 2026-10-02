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

const VISIBILITY_OPTIONS = [
  { value: 'PRIVATE', label: 'Private', icon: 'lock-outline' },
  { value: 'PUBLIC', label: 'Public', icon: 'earth' },
];

/** Full-page modal for the Challenges "Browse": join public challenges, or create a new one. */
export default function ChallengesManageModal({ visible, onClose }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { browseList, busy, createChallenge, joinChallenge } = useChallenges();

  const [name, setName] = useState('');
  const [targetCount, setTargetCount] = useState('5');
  const [lengthDays, setLengthDays] = useState('7');
  const [visibility, setVisibility] = useState('PRIVATE');

  const handleCreate = async () => {
    const trimmedName = name.trim();
    const target = parseInt(targetCount, 10);
    const length = parseInt(lengthDays, 10);
    if (!trimmedName) {
      Alert.alert('Name it', 'Give the challenge a name.');
      return;
    }
    if (!Number.isFinite(target) || target < 1) {
      Alert.alert('Set a target', 'Target days must be at least 1.');
      return;
    }
    if (!Number.isFinite(length) || length < 1 || length > MAX_LENGTH_DAYS) {
      Alert.alert('Set a length', `Length must be between 1 and ${MAX_LENGTH_DAYS} days.`);
      return;
    }
    const periodStart = toDateKey(new Date());
    const periodEnd = toDateKey(new Date(Date.now() + length * 24 * 60 * 60 * 1000));

    const ok = await createChallenge({ name: trimmedName, targetCount: target, periodStart, periodEnd, visibility });
    if (ok) {
      setName('');
      setTargetCount('5');
      setLengthDays('7');
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
              <Text style={styles.inputLabel}>Target (days)</Text>
              <TextInput
                style={[styles.input, styles.numberInput]}
                keyboardType="number-pad"
                value={targetCount}
                onChangeText={setTargetCount}
              />
            </View>

            <View style={styles.row}>
              <Text style={styles.inputLabel}>Length (days, max {MAX_LENGTH_DAYS})</Text>
              <TextInput
                style={[styles.input, styles.numberInput]}
                keyboardType="number-pad"
                value={lengthDays}
                onChangeText={setLengthDays}
              />
            </View>

            <View style={styles.lengthRow}>
              {VISIBILITY_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={[styles.lengthOption, visibility === option.value && styles.lengthOptionActive]}
                  onPress={() => setVisibility(option.value)}
                >
                  <MaterialCommunityIcons
                    name={option.icon}
                    size={14}
                    color={visibility === option.value ? colors.accent : colors.textSecondary}
                  />
                  <Text
                    style={[styles.lengthOptionText, visibility === option.value && styles.lengthOptionTextActive]}
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
    inputLabel: { fontSize: 14, color: colors.textSecondary },
    numberInput: { width: 72, marginBottom: 0, textAlign: 'center' },
    lengthRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    lengthOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: colors.background,
    },
    lengthOptionActive: { backgroundColor: colors.accentSoft },
    lengthOptionText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    lengthOptionTextActive: { color: colors.accent },
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
