import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { useFriends } from '../hooks/useFriends';
import { useGroups } from '../hooks/useGroups';
import { useHabits } from '../hooks/useHabits';
import { radii, shadow, spacing } from '../theme';

const RULE_OPTIONS = [
  { value: 'ANY_MEMBER', label: 'Any member' },
  { value: 'ALL_MEMBERS', label: 'All members' },
];

/** Full-page modal for the Shared Habits "See all": friends, requests, invites, and creating a group. */
export default function GroupsManageModal({ visible, onClose }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);

  const { friends, pendingRequests, busy: friendsBusy, sendRequest, acceptRequest, declineRequest } = useFriends();
  const { groups, pendingInvites, busy: groupsBusy, createGroup, inviteToGroup, acceptInvite } = useGroups();
  const { habits } = useHabits();

  const [email, setEmail] = useState('');
  const [groupName, setGroupName] = useState('');
  const [selectedHabitId, setSelectedHabitId] = useState(null);
  const [rule, setRule] = useState('ANY_MEMBER');
  const [acceptingInviteId, setAcceptingInviteId] = useState(null);
  const [inviteHabitId, setInviteHabitId] = useState(null);
  const [invitingGroupId, setInvitingGroupId] = useState(null);

  const busy = friendsBusy || groupsBusy;

  const handleSendRequest = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    const ok = await sendRequest(trimmed);
    if (ok) setEmail('');
    else Alert.alert("Couldn't send request", 'Check the email and try again.');
  };

  const handleCreateGroup = async () => {
    if (!selectedHabitId) {
      Alert.alert('Pick a habit', 'Choose which of your habits this shared habit tracks.');
      return;
    }
    const habit = habits.find((h) => h.id === selectedHabitId);
    const name = groupName.trim() || (habit ? habit.name : 'Shared Habit');
    const ok = await createGroup({ name, habitId: selectedHabitId, streakRule: rule });
    if (ok) {
      setGroupName('');
      setSelectedHabitId(null);
    } else {
      Alert.alert("Couldn't create shared habit", 'Something went wrong — try again.');
    }
  };

  const handleAcceptInvite = async (groupId) => {
    if (!inviteHabitId) {
      Alert.alert('Pick a habit', 'Choose which of your own habits to link to this group.');
      return;
    }
    const ok = await acceptInvite(groupId, inviteHabitId);
    if (ok) {
      setAcceptingInviteId(null);
      setInviteHabitId(null);
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
                <View key={invite.groupId} style={styles.inviteCard}>
                  <Text style={styles.inviteName}>{invite.groupName}</Text>
                  <Text style={styles.inviteMeta}>
                    From {invite.invitedBy} · {invite.streakRule === 'ALL_MEMBERS' ? 'All members' : 'Any member'}
                  </Text>

                  {acceptingInviteId === invite.groupId ? (
                    <View style={styles.habitPicker}>
                      <Text style={styles.habitPickerLabel}>Link which of your habits?</Text>
                      {habits.length === 0 ? (
                        <Text style={styles.emptyNote}>Create a habit first on the Habits tab.</Text>
                      ) : (
                        habits.map((habit) => (
                          <Pressable
                            key={habit.id}
                            style={styles.habitRow}
                            onPress={() => setInviteHabitId(habit.id)}
                          >
                            <MaterialCommunityIcons
                              name={inviteHabitId === habit.id ? 'radiobox-marked' : 'radiobox-blank'}
                              size={18}
                              color={inviteHabitId === habit.id ? colors.accent : colors.textMuted}
                            />
                            <Text style={styles.habitRowText}>{habit.name}</Text>
                          </Pressable>
                        ))
                      )}
                      <View style={styles.inlineButtonRow}>
                        <Pressable
                          style={styles.secondaryButton}
                          onPress={() => {
                            setAcceptingInviteId(null);
                            setInviteHabitId(null);
                          }}
                        >
                          <Text style={styles.secondaryButtonText}>Cancel</Text>
                        </Pressable>
                        <Pressable
                          style={styles.primaryButton}
                          disabled={busy}
                          onPress={() => handleAcceptInvite(invite.groupId)}
                        >
                          <Text style={styles.primaryButtonText}>Join</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.primaryButton}
                      onPress={() => {
                        setAcceptingInviteId(invite.groupId);
                        setInviteHabitId(null);
                      }}
                    >
                      <Text style={styles.primaryButtonText}>Accept</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </Section>
          ) : null}

          {/* Create a shared habit */}
          <Section title="Create a shared habit" styles={styles}>
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

            <Pressable
              style={[styles.primaryButton, styles.fullWidthButton]}
              disabled={busy || !selectedHabitId}
              onPress={handleCreateGroup}
            >
              <Text style={styles.primaryButtonText}>Create</Text>
            </Pressable>
          </Section>

          {/* Your shared habits — invite friends into them */}
          {groups.length > 0 ? (
            <Section title="Invite friends to your shared habits" styles={styles}>
              {groups.map((group) => (
                <View key={group.id} style={styles.inviteCard}>
                  <Text style={styles.inviteName}>{group.name}</Text>

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
          ) : null}

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
    helperText: { ...typography.meta, marginBottom: spacing.md },
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
    ruleRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
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
    fullWidthButton: { marginTop: spacing.lg, alignSelf: 'stretch', alignItems: 'center' },
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
