import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import StreakIndicator from './StreakIndicator';
import InviteFriendsSheet from './InviteFriendsSheet';
import CreateGroupModal from './CreateGroupModal';
import AvatarImage from './AvatarImage';
import FriendProfileModal from './FriendProfileModal';
import Toast from './Toast';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAuth } from '../hooks/useAuth';
import { useGroups } from '../hooks/useGroups';
import { useHabits } from '../hooks/useHabits';
import { useToast } from '../hooks/useToast';
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
  const { user } = useAuth();
  const { inviteToGroup, nudge, busy, refresh: refreshGroups } = useGroups();
  const { toggleCheckIn, busy: habitsBusy } = useHabits();
  const [inviteVisible, setInviteVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [profileUserId, setProfileUserId] = useState(null);
  const { toast, showToast, hideToast } = useToast();

  if (!group) return null;

  const state = resolveStreakState(group.streakStatus);
  const people = Array.isArray(group.participants) ? group.participants : [];
  const isIndependent = group.trackingMode === 'INDEPENDENT';
  const myParticipant = people.find((p) => typeof p === 'object' && p && user && p.userId === user.uid);
  const myCheckedInToday = myParticipant ? myParticipant.checkedInToday : false;

  // InviteFriendsSheet owns the success/failure feedback (including the
  // real backend reason, e.g. "already invited") — this just passes the
  // call through rather than swallowing it to a boolean.
  const handleInvite = (friendUserId) => inviteToGroup(group.id, friendUserId);

  // toggleCheckIn only refreshes useHabits' own list — this modal's `group` prop comes from
  // useGroups' separate list, which never hears about it otherwise. Without this refresh the
  // button looked completely unresponsive: the check-in landed, but checkedInToday here never
  // flipped, because group never got refetched.
  const handleToggleMyCheckIn = async () => {
    if (!group.myHabitId) return;
    try {
      await toggleCheckIn(group.myHabitId);
      await refreshGroups();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update check-in', 'error');
    }
  };

  const handleNudge = async (targetUserId, label) => {
    try {
      await nudge(group.id, targetUserId);
      showToast(`Nudge sent — ${label} will get a reminder.`, 'success');
    } catch (err) {
      showToast(err?.message || "Couldn't send nudge — try again.", 'error');
    }
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
          {group.canEdit ? (
            <Pressable onPress={() => setEditVisible(true)} hitSlop={12} style={styles.closeBtn}>
              <MaterialCommunityIcons name="pencil-outline" size={20} color={colors.accent} />
            </Pressable>
          ) : (
            <View style={{ width: 34 }} />
          )}
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            {!isIndependent ? <StreakIndicator streak={group.streak} status={group.streakStatus} showLabel /> : null}
            <View style={styles.heroRow}>
              {!isIndependent ? (
                <View style={styles.ruleBadge}>
                  <MaterialCommunityIcons name="shield-check-outline" size={13} color={colors.textSecondary} />
                  <Text style={styles.ruleText}>{RULE_LABEL[group.rule] || RULE_LABEL.any_member}</Text>
                </View>
              ) : (
                <View style={styles.ruleBadge}>
                  <MaterialCommunityIcons name="account-multiple-outline" size={13} color={colors.textSecondary} />
                  <Text style={styles.ruleText}>Independent streaks</Text>
                </View>
              )}
              <View style={styles.ruleBadge}>
                <MaterialCommunityIcons name="target" size={13} color={colors.textSecondary} />
                <Text style={styles.ruleText}>{group.goalAlignment === 'SPLIT' ? 'Split goal' : 'Unified goal'}</Text>
              </View>
              {!isIndependent ? (
                <View style={[styles.statusBadge, { backgroundColor: state.background }]}>
                  <MaterialCommunityIcons name={state.icon} size={13} color={state.color} />
                  <Text style={[styles.statusText, { color: state.color }]}>{state.label}</Text>
                </View>
              ) : null}
            </View>
            {!isIndependent && group.longestStreak != null ? (
              <Text style={styles.longestStreak}>Longest streak: {group.longestStreak}d</Text>
            ) : null}
            {!isIndependent ? (
              <Text style={styles.longestStreak}>
                {group.skipDaysPerMonth} skip day{group.skipDaysPerMonth === 1 ? '' : 's'} allowed a month
              </Text>
            ) : null}
            <Text style={styles.longestStreak}>
              {group.visibilityLevel === 'STATUS_ONLY' ? 'Status only — amounts hidden from groupmates' : 'Full details visible to groupmates'}
            </Text>

            {group.myHabitId ? (
              <Pressable
                style={[styles.logButton, myCheckedInToday && styles.logButtonActive]}
                disabled={habitsBusy}
                accessibilityRole="button"
                accessibilityLabel={myCheckedInToday ? 'Unlog today' : 'Log today'}
                onPress={handleToggleMyCheckIn}
              >
                <MaterialCommunityIcons
                  name={myCheckedInToday ? 'check' : 'plus'}
                  size={16}
                  color={myCheckedInToday ? '#FFFFFF' : colors.accent}
                />
                <Text style={[styles.logButtonText, myCheckedInToday && styles.logButtonTextActive]}>
                  {myCheckedInToday ? 'Checked in today' : 'Check in today'}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.sectionTitle}>
            {people.length} {people.length === 1 ? 'member' : 'members'}
          </Text>
          {people.map((person, index) => {
            const label = typeof person === 'string' ? person : person && person.name;
            const personUserId = typeof person === 'object' && person ? person.userId : null;
            const personStreak = typeof person === 'object' && person ? person.currentStreak : null;
            const personCheckedInToday = typeof person === 'object' && person ? person.checkedInToday : false;
            const personPhotoUrl = typeof person === 'object' && person ? person.photoUrl : null;
            const isSelf = personUserId && user && personUserId === user.uid;
            return (
              <View key={`${label}-${index}`} style={styles.memberRow}>
                <Pressable
                  style={styles.memberTapTarget}
                  disabled={!personUserId || isSelf}
                  onPress={() => setProfileUserId(personUserId)}
                  accessibilityRole={!isSelf && personUserId ? 'button' : undefined}
                  accessibilityLabel={!isSelf && personUserId ? `View ${label}'s profile` : undefined}
                >
                  <View
                    style={[
                      styles.avatar,
                      personPhotoUrl
                        ? styles.avatarPhoto
                        : { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] },
                    ]}
                  >
                    {personPhotoUrl ? (
                      <AvatarImage uri={personPhotoUrl} name={label} size={32} fontSize={13} />
                    ) : (
                      <Text style={styles.avatarText}>{initials(label)}</Text>
                    )}
                  </View>
                  <Text style={styles.memberName}>{label}</Text>
                </Pressable>
                {isIndependent ? <Text style={styles.memberStreak}>🔥 {personStreak ?? 0}</Text> : null}
                {personCheckedInToday ? (
                  <MaterialCommunityIcons name="check-circle" size={16} color={colors.safe} style={{ marginRight: spacing.xs }} />
                ) : null}
                {group.nudgesEnabled && !isSelf && personUserId ? (
                  <Pressable
                    style={styles.nudgeBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Nudge ${label}`}
                    onPress={() => handleNudge(personUserId, label)}
                  >
                    <MaterialCommunityIcons name="hand-wave-outline" size={16} color={colors.accent} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}

          <View style={styles.inviteSection}>
            <Pressable style={styles.secondaryButton} onPress={() => setInviteVisible(true)}>
              <MaterialCommunityIcons name="account-plus-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.secondaryButtonText}>Invite a friend</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>

      <InviteFriendsSheet
        visible={inviteVisible}
        onClose={() => setInviteVisible(false)}
        onInvite={handleInvite}
        busy={busy}
        title={`Invite to ${group.name}`}
      />
      <CreateGroupModal
        visible={editVisible}
        group={group}
        onClose={() => setEditVisible(false)}
        onDeleted={() => {
          setEditVisible(false);
          onClose();
        }}
      />
      <FriendProfileModal visible={!!profileUserId} userId={profileUserId} onClose={() => setProfileUserId(null)} />
      <Toast toast={toast} onHide={hideToast} />
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
    heroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
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
    logButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: colors.accentSoft,
      borderRadius: radii.pill,
      paddingVertical: spacing.sm,
      marginTop: spacing.md,
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
    memberTapTarget: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
    avatarPhoto: { backgroundColor: colors.surface, overflow: 'hidden' },
    memberName: { fontSize: 14, color: colors.textPrimary, flex: 1 },
    memberStreak: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginRight: spacing.sm },
    nudgeBtn: {
      width: 30,
      height: 30,
      borderRadius: radii.pill,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inviteSection: { marginTop: spacing.lg },
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
