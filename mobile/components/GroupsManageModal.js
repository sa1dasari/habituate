import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { useFriends } from '../hooks/useFriends';
import { useGroups } from '../hooks/useGroups';
import { useHabits } from '../hooks/useHabits';
import { radii, shadow, spacing } from '../theme';

/**
 * Pure management view for the Shared Habits "See all": pending invites,
 * your existing groups (invite more friends into them), friend requests,
 * and the friends list — creating a new shared habit lives in CreateGroupModal.
 */
export default function GroupsManageModal({ visible, onClose }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);

  const { friends, pendingRequests, busy: friendsBusy, sendRequest, acceptRequest, declineRequest } = useFriends();
  const { groups, pendingInvites, busy: groupsBusy, inviteToGroup, acceptInvite } = useGroups();

  const [email, setEmail] = useState('');
  const [acceptingInviteId, setAcceptingInviteId] = useState(null);
  const [invitingGroupId, setInvitingGroupId] = useState(null);

  const busy = friendsBusy || groupsBusy;

  const handleSendRequest = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    const ok = await sendRequest(trimmed);
    if (ok) setEmail('');
    else Alert.alert("Couldn't send request", 'Check the email and try again.');
  };

  const handleAcceptInvite = async (groupId, habitId) => {
    const ok = await acceptInvite(groupId, habitId);
    if (ok) {
      setAcceptingInviteId(null);
    } else {
      Alert.alert("Couldn't join", 'Something went wrong — try again.');
    }
  };

  const handleInviteFriend = async (groupId, friendUserId) => {
    const ok = await inviteToGroup(groupId, friendUserId);
    if (ok) {
      setInvitingGroupId(null);
    } else {
      Alert.alert("Couldn't send invite", 'Something went wrong — try again.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle}>Shared Habits</Text>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Pending group invites */}
          {pendingInvites.length > 0 ? (
            <Section title="Invites waiting for you" styles={styles}>
              {pendingInvites.map((invite) => (
                <GroupInviteRow
                  key={invite.groupId}
                  invite={invite}
                  accepting={acceptingInviteId === invite.groupId}
                  busy={busy}
                  styles={styles}
                  colors={colors}
                  onStartAccept={() => setAcceptingInviteId(invite.groupId)}
                  onCancelAccept={() => setAcceptingInviteId(null)}
                  onConfirmAccept={(habitId) => handleAcceptInvite(invite.groupId, habitId)}
                />
              ))}
            </Section>
          ) : null}

          {/* Your shared habits — invite friends into them */}
          {groups.length > 0 ? (
            <Section title="Your shared habits" styles={styles}>
              {groups.map((group) => (
                <View key={group.id} style={styles.inviteCard}>
                  <Text style={styles.inviteName}>{group.name}</Text>
                  <Text style={styles.inviteMeta}>
                    {group.participantCount} {group.participantCount === 1 ? 'member' : 'members'} · {group.streak}d
                    streak
                  </Text>

                  {invitingGroupId === group.id ? (
                    friends.length === 0 ? (
                      <Text style={styles.emptyNote}>Add a friend below first.</Text>
                    ) : (
                      friends.map((friend) => (
                        <Pressable
                          key={friend.id}
                          style={styles.habitRow}
                          onPress={() => handleInviteFriend(group.id, friend.otherUserId)}
                        >
                          <MaterialCommunityIcons name="account-plus-outline" size={18} color={colors.accent} />
                          <Text style={styles.habitRowText}>{friend.otherUserName || friend.otherUserEmail}</Text>
                        </Pressable>
                      ))
                    )
                  ) : (
                    <Pressable style={styles.secondaryButton} onPress={() => setInvitingGroupId(group.id)}>
                      <Text style={styles.secondaryButtonText}>Invite a friend</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </Section>
          ) : (
            <Text style={styles.emptyNote}>No shared habits yet — tap Create to start one.</Text>
          )}

          {/* Friend requests */}
          {pendingRequests.length > 0 ? (
            <Section title="Friend requests" styles={styles}>
              {pendingRequests.map((request) => (
                <View key={request.id} style={styles.friendRow}>
                  <Text style={styles.friendName}>{request.otherUserName || request.otherUserEmail}</Text>
                  <View style={styles.inlineButtonRow}>
                    <Pressable
                      style={styles.secondaryButton}
                      disabled={busy}
                      onPress={() => declineRequest(request.id)}
                    >
                      <Text style={styles.secondaryButtonText}>Decline</Text>
                    </Pressable>
                    <Pressable style={styles.primaryButton} disabled={busy} onPress={() => acceptRequest(request.id)}>
                      <Text style={styles.primaryButtonText}>Accept</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </Section>
          ) : null}

          {/* Friends + invite by email */}
          <Section title="Friends" styles={styles}>
            <View style={styles.inviteRow}>
              <TextInput
                style={[styles.input, styles.inviteInput]}
                placeholder="Friend's email"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <Pressable style={styles.primaryButton} disabled={busy || !email.trim()} onPress={handleSendRequest}>
                <Text style={styles.primaryButtonText}>Invite</Text>
              </Pressable>
            </View>

            {friends.length === 0 ? (
              <Text style={styles.emptyNote}>No friends yet — invite someone by email above.</Text>
            ) : (
              friends.map((friend) => (
                <View key={friend.id} style={styles.friendRow}>
                  <Text style={styles.friendName}>{friend.otherUserName || friend.otherUserEmail}</Text>
                </View>
              ))
            )}
          </Section>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function GroupInviteRow({ invite, accepting, busy, styles, colors, onStartAccept, onCancelAccept, onConfirmAccept }) {
  const { habits } = useHabits();
  const [habitId, setHabitId] = useState(null);

  return (
    <View style={styles.inviteCard}>
      <Text style={styles.inviteName}>{invite.groupName}</Text>
      <Text style={styles.inviteMeta}>
        From {invite.invitedBy} · {invite.streakRule === 'ALL_MEMBERS' ? 'All members' : 'Any member'}
      </Text>

      {accepting ? (
        <View style={styles.habitPicker}>
          <Text style={styles.habitPickerLabel}>Link which of your habits?</Text>
          {habits.length === 0 ? (
            <Text style={styles.emptyNote}>Create a habit first on the Habits tab.</Text>
          ) : (
            habits.map((habit) => (
              <Pressable key={habit.id} style={styles.habitRow} onPress={() => setHabitId(habit.id)}>
                <MaterialCommunityIcons
                  name={habitId === habit.id ? 'radiobox-marked' : 'radiobox-blank'}
                  size={18}
                  color={habitId === habit.id ? colors.accent : colors.textMuted}
                />
                <Text style={styles.habitRowText}>{habit.name}</Text>
              </Pressable>
            ))
          )}
          <View style={styles.inlineButtonRow}>
            <Pressable style={styles.secondaryButton} onPress={onCancelAccept}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={styles.primaryButton}
              disabled={busy || !habitId}
              onPress={() => onConfirmAccept(habitId)}
            >
              <Text style={styles.primaryButtonText}>Join</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.primaryButton} onPress={onStartAccept}>
          <Text style={styles.primaryButtonText}>Accept</Text>
        </Pressable>
      )}
    </View>
  );
}

function Section({ title, children, styles }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
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
    emptyNote: { ...typography.meta, marginBottom: spacing.sm },
    inviteCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      ...shadow,
    },
    inviteName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    inviteMeta: { ...typography.meta, marginTop: 2, marginBottom: spacing.md },
    habitPicker: { marginTop: spacing.sm },
    habitPickerLabel: { ...typography.label, marginBottom: spacing.sm },
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
    inlineButtonRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    primaryButton: {
      backgroundColor: colors.accent,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    primaryButtonText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
    secondaryButton: {
      backgroundColor: colors.background,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    secondaryButtonText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
    friendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    friendName: { fontSize: 14, color: colors.textPrimary },
    inviteRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginBottom: spacing.md },
    inviteInput: { flex: 1, marginTop: 0 },
  });
}
