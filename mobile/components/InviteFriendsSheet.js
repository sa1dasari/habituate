import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AddFriendModal from './AddFriendModal';
import AvatarImage from './AvatarImage';
import Toast from './Toast';
import { useAppTheme } from '../hooks/useAppTheme';
import { useFriends } from '../hooks/useFriends';
import { useToast } from '../hooks/useToast';
import { radii, spacing } from '../theme';

/**
 * One invite picker shared by every "invite to X" flow (Shared Habits,
 * Challenges, Raids) instead of each screen rolling its own — the earlier
 * bug was each one inlining the same "pick a friend" list with no fallback
 * when the list was empty, pointing at an "Add a friend" feature that
 * didn't actually exist anywhere.
 *
 * `onInvite(friendUserId)` should resolve on success or throw/reject with an
 * Error on failure, like every other action hook in this app (useGroups.
 * inviteToGroup, etc, which rethrow the backend's actual reason rather than
 * swallowing it) — this is the one place that shows the user whether the
 * invite worked at all, across every "invite to X" flow that uses it.
 */
export default function InviteFriendsSheet({ visible, onClose, onInvite, busy = false, title = 'Invite a friend' }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { friends } = useFriends();
  const [addFriendVisible, setAddFriendVisible] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  const handlePick = async (friendUserId, label) => {
    try {
      await onInvite(friendUserId);
      // The toast renders inside this same Modal, so closing it immediately
      // would hide the toast along with it before anyone could read it —
      // show the confirmation first, close shortly after.
      showToast(`Invite sent — ${label} will see it next time they open Habituate.`, 'success');
      setTimeout(onClose, 900);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't send invite — try again.", 'error');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {friends.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="account-plus-outline" size={28} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No friends yet</Text>
              <Text style={styles.emptyBody}>Add one first, then invite them here.</Text>
              <Pressable style={styles.primaryButton} onPress={() => setAddFriendVisible(true)}>
                <Text style={styles.primaryButtonText}>Add a friend</Text>
              </Pressable>
            </View>
          ) : (
            friends.map((friend) => (
              <Pressable
                key={friend.id}
                style={styles.friendRow}
                disabled={busy}
                onPress={() => handlePick(friend.otherUserId, friend.otherUserName || friend.otherUserEmail)}
              >
                <View style={styles.friendAvatar}>
                  <AvatarImage
                    uri={friend.otherUserPhotoUrl}
                    name={friend.otherUserName || friend.otherUserEmail}
                    size={28}
                    fontSize={12}
                  />
                </View>
                <Text style={styles.friendName} numberOfLines={1}>
                  {friend.otherUserName || friend.otherUserEmail}
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      </SafeAreaView>

      <AddFriendModal visible={addFriendVisible} onClose={() => setAddFriendVisible(false)} />
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
    headerTitle: { ...typography.sectionTitle },
    closeBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
    friendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm + 2 },
    friendAvatar: {
      width: 28,
      height: 28,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    friendName: { fontSize: 14, color: colors.textPrimary },
    emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
    emptyTitle: { ...typography.cardTitle, marginTop: spacing.sm },
    emptyBody: { ...typography.meta, marginTop: spacing.xs, marginBottom: spacing.lg, textAlign: 'center' },
    primaryButton: {
      backgroundColor: colors.accent,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm + 2,
    },
    primaryButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  });
}
