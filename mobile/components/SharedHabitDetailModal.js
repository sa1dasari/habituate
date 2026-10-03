import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import StreakIndicator from './StreakIndicator';
import { useAppTheme } from '../hooks/useAppTheme';
import { useFriends } from '../hooks/useFriends';
import { useGroups } from '../hooks/useGroups';
import { radii, shadow, spacing } from '../theme';

const RULE_LABEL = {
  all_members: 'All members',
  any_member: 'Any member',
};

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

/** Detail view for one Shared Habit, opened by tapping its card — not the create/manage flow. */
export default function SharedHabitDetailModal({ visible, group, onClose }) {
  const { colors, resolveStreakState, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { friends } = useFriends();
  const { inviteToGroup, busy } = useGroups();
  const [inviting, setInviting] = useState(false);

  if (!group) return null;

  const state = resolveStreakState(group.streakStatus);
  const people = Array.isArray(group.participants) ? group.participants : [];

  const handleInvite = async (friendUserId) => {
    const ok = await inviteToGroup(group.id, friendUserId);
    if (ok) setInviting(false);
    else Alert.alert("Couldn't send invite", 'Something went wrong — try again.');
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {group.name}
          </Text>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <StreakIndicator streak={group.streak} status={group.streakStatus} showLabel />
            <View style={styles.heroRow}>
              <View style={styles.ruleBadge}>
                <MaterialCommunityIcons name="shield-check-outline" size={13} color={colors.textSecondary} />
                <Text style={styles.ruleText}>{RULE_LABEL[group.rule] || RULE_LABEL.any_member}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: state.background }]}>
                <MaterialCommunityIcons name={state.icon} size={13} color={state.color} />
                <Text style={[styles.statusText, { color: state.color }]}>{state.label}</Text>
              </View>
            </View>
            {group.longestStreak != null ? (
              <Text style={styles.longestStreak}>Longest streak: {group.longestStreak}d</Text>
            ) : null}
          </View>

          <Text style={styles.sectionTitle}>
            {people.length} {people.length === 1 ? 'member' : 'members'}
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

          <View style={styles.inviteSection}>
            {inviting ? (
              friends.length === 0 ? (
                <Text style={styles.emptyNote}>Add a friend from the Community page first.</Text>
              ) : (
                friends.map((friend) => (
                  <Pressable
                    key={friend.id}
                    style={styles.habitRow}
                    disabled={busy}
                    onPress={() => handleInvite(friend.otherUserId)}
                  >
                    <MaterialCommunityIcons name="account-plus-outline" size={18} color={colors.accent} />
                    <Text style={styles.habitRowText}>{friend.otherUserName || friend.otherUserEmail}</Text>
                  </Pressable>
                ))
              )
            ) : (
              <Pressable style={styles.secondaryButton} onPress={() => setInviting(true)}>
                <MaterialCommunityIcons name="account-plus-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.secondaryButtonText}>Invite a friend</Text>
              </Pressable>
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
    heroRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    ruleBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.background,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs,
    },
    ruleText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs,
    },
    statusText: { fontSize: 11, fontWeight: '700' },
    longestStreak: { ...typography.meta, marginTop: spacing.md },
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
    inviteSection: { marginTop: spacing.lg },
    emptyNote: { ...typography.meta },
    habitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
    habitRowText: { fontSize: 14, color: colors.textPrimary },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: colors.background,
      borderRadius: radii.pill,
      paddingVertical: spacing.sm,
    },
    secondaryButtonText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  });
}
