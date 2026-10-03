import React, { useMemo } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../hooks/useAppTheme';
import { useChallenges } from '../hooks/useChallenges';
import { gradients, radii, shadow, spacing } from '../theme';

const AVATAR_COLORS = ['#2563EB', '#7C3AED', '#0891B2', '#DB2777', '#EA580C'];

function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

const VISIBILITY_LABEL = { PUBLIC: 'Public', PRIVATE: 'Private' };

/** Detail view for one Challenge, opened by tapping its card — not the create/browse flow. */
export default function ChallengeDetailModal({ visible, challenge, onClose }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { toggleCheckIn, busy } = useChallenges();

  if (!challenge) return null;

  const people = Array.isArray(challenge.participants) ? challenge.participants : [];

  const handleToggle = async () => {
    const ok = await toggleCheckIn(challenge);
    if (!ok) Alert.alert("Couldn't update today's log", 'Something went wrong — try again.');
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {challenge.name}
          </Text>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            {challenge.description ? <Text style={styles.description}>{challenge.description}</Text> : null}

            <View style={styles.metaRow}>
              <View style={styles.metaBadge}>
                <MaterialCommunityIcons name="calendar-range" size={13} color={colors.textSecondary} />
                <Text style={styles.metaText}>
                  {challenge.periodStart} – {challenge.periodEnd}
                </Text>
              </View>
              <View style={styles.metaBadge}>
                <MaterialCommunityIcons
                  name={challenge.visibility === 'PUBLIC' ? 'earth' : 'lock-outline'}
                  size={13}
                  color={colors.textSecondary}
                />
                <Text style={styles.metaText}>{VISIBILITY_LABEL[challenge.visibility] || 'Private'}</Text>
              </View>
            </View>

            {challenge.joined ? (
              <>
                <Text style={styles.progressLabel}>
                  {challenge.myProgress}/{challenge.targetCount} days · {challenge.progressPercent}%
                </Text>
                <View style={styles.progressTrack}>
                  <LinearGradient
                    colors={gradients.accent}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressFill, { width: `${Math.max(4, challenge.progressPercent)}%` }]}
                  />
                </View>

                <Pressable
                  style={[styles.logButton, challenge.checkedInToday && styles.logButtonActive]}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={challenge.checkedInToday ? 'Unlog today' : 'Log today'}
                  onPress={handleToggle}
                >
                  <MaterialCommunityIcons
                    name={challenge.checkedInToday ? 'check' : 'plus'}
                    size={16}
                    color={challenge.checkedInToday ? '#FFFFFF' : colors.accent}
                  />
                  <Text style={[styles.logButtonText, challenge.checkedInToday && styles.logButtonTextActive]}>
                    {challenge.checkedInToday ? 'Logged today' : 'Log today'}
                  </Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.notJoinedNote}>You haven't joined this challenge.</Text>
            )}
          </View>

          <Text style={styles.sectionTitle}>
            {people.length} {people.length === 1 ? 'participant' : 'participants'}
          </Text>
          {people.map((person, index) => {
            const label = typeof person === 'string' ? person : person && person.name;
            return (
              <View key={`${label}-${index}`} style={styles.memberRow}>
                <View style={[styles.avatar, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
                  <Text style={styles.avatarText}>{initials(label)}</Text>
                </View>
                <Text style={styles.memberName}>{label}</Text>
              </View>
            );
          })}
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
    headerTitle: { ...typography.sectionTitle, flex: 1, textAlign: 'center' },
    closeBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
    heroCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: spacing.xl,
      ...shadow,
    },
    description: { ...typography.body, marginBottom: spacing.md },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
    metaBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.background,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs,
    },
    metaText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
    progressLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
    progressTrack: {
      height: 8,
      borderRadius: radii.pill,
      backgroundColor: colors.ringTrack,
      overflow: 'hidden',
      marginBottom: spacing.lg,
    },
    progressFill: { height: '100%', borderRadius: radii.pill },
    notJoinedNote: { ...typography.meta },
    logButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: colors.accentSoft,
      borderRadius: radii.pill,
      paddingVertical: spacing.sm,
    },
    logButtonActive: { backgroundColor: colors.accent },
    logButtonText: { fontSize: 13, fontWeight: '700', color: colors.accent },
    logButtonTextActive: { color: '#FFFFFF' },
    sectionTitle: { ...typography.sectionTitle, marginBottom: spacing.md },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
    memberName: { fontSize: 14, color: colors.textPrimary },
  });
}
