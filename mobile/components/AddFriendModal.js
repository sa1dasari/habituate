import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import api from '../api/client';
import AvatarImage from './AvatarImage';
import FriendProfileModal from './FriendProfileModal';
import Toast from './Toast';
import { useAppTheme } from '../hooks/useAppTheme';
import { useFriends } from '../hooks/useFriends';
import { useToast } from '../hooks/useToast';
import { radii, shadow, spacing } from '../theme';

const SEARCH_DEBOUNCE_MS = 350;

const MODE_OPTIONS = [
  { value: 'username', label: 'By username' },
  { value: 'email', label: 'By email' },
];

// Mirrors UserSearchResult.relationshipStatus from the backend — a search result whose
// relationship is anything but null/undefined can't be sent a new request (the backend
// rejects the duplicate), so the button must say something other than "Add".
const RELATIONSHIP_LABELS = {
  FRIENDS: 'Friends',
  REQUEST_SENT: 'Sent',
  REQUEST_RECEIVED: 'Pending',
  DECLINED: 'Sent',
};

/**
 * The UI half of a friend-request system whose backend already existed
 * (FriendshipController/useFriends) but had no entry point anywhere in the
 * app — this is what "invite a friend" on a Shared Habit was silently
 * depending on and never finding. Username search is the primary path now
 * (no need to know someone's sign-in email); email stays as a fallback.
 */
export default function AddFriendModal({ visible, onClose }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { friends, pendingRequests, loading, refresh, busy, sendRequest, sendRequestByUsername, acceptRequest, declineRequest } =
    useFriends();
  const [mode, setMode] = useState('username');
  const [email, setEmail] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sentTo, setSentTo] = useState(() => new Set());
  const [profileUserId, setProfileUserId] = useState(null);
  const debounceRef = useRef(null);
  const { toast, showToast, hideToast } = useToast();

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setSentTo(new Set());
      return;
    }
    // The friends/requests context only refreshes on app launch and after an
    // action this device performed — it has no idea a friend accepted or
    // sent a request elsewhere during this session. Without this, both
    // lists can sit stale for the entire app lifetime.
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const found = await api.searchUsers(trimmed);
        setResults(found || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleSendByUsername = async (username) => {
    try {
      await sendRequestByUsername(username);
      setSentTo((current) => new Set(current).add(username));
      showToast(`Request sent to @${username}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't send that — try again.", 'error');
    }
  };

  const handleSendByEmail = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      showToast("Your friend's account email, same as they sign in with.", 'info');
      return;
    }
    try {
      await sendRequest(trimmed);
      setEmail('');
      showToast("Request sent — they'll see it next time they open Habituate.", 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Couldn't send that — check the email is right and that an account exists for it.",
        'error'
      );
    }
  };

  const handleRespond = async (request, accept) => {
    try {
      await (accept ? acceptRequest(request.id) : declineRequest(request.id));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Something went wrong — try again.', 'error');
      return;
    }
    // Accepting a new friend is a bigger moment than declining, which stays neutral —
    // no shaming feel for the person who gets declined, or the one declining.
    if (accept) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle}>Friends</Text>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        >
          <Text style={styles.label}>Your friends</Text>
          {friends.length === 0 ? (
            <Text style={styles.hint}>No friends yet — search for one below to get started.</Text>
          ) : (
            friends.map((friend) => (
              <Pressable
                key={friend.id}
                style={styles.requestRow}
                onPress={() => setProfileUserId(friend.otherUserId)}
                accessibilityRole="button"
                accessibilityLabel={`View ${friend.otherUserName || friend.otherUserEmail}'s profile`}
              >
                <AvatarImage
                  uri={friend.otherUserPhotoUrl}
                  name={friend.otherUserName || friend.otherUserEmail}
                  size={28}
                  fontSize={12}
                />
                <Text style={[styles.requestName, { marginLeft: spacing.sm }]} numberOfLines={1}>
                  {friend.otherUserName || friend.otherUserEmail}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} />
              </Pressable>
            ))
          )}

          <Text style={[styles.label, styles.sectionSpacing]}>Add a friend</Text>

          <View style={styles.modeRow}>
            {MODE_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                style={[styles.modePill, mode === option.value && styles.modePillActive]}
                onPress={() => setMode(option.value)}
              >
                <Text style={[styles.modePillText, mode === option.value && styles.modePillTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {mode === 'username' ? (
            <>
              <View style={styles.row}>
                <TextInput
                  style={styles.input}
                  placeholder="Search by username"
                  placeholderTextColor={colors.textMuted}
                  value={query}
                  onChangeText={setQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searching ? <ActivityIndicator color={colors.accent} size="small" style={styles.searchSpinner} /> : null}
              </View>

              {query.trim().length >= 2 && !searching && results.length === 0 ? (
                <Text style={styles.hint}>No one found with that username.</Text>
              ) : null}

              {results.map((result) => {
                // sentTo covers a request sent THIS session (optimistic, before refresh() has
                // caught up); relationshipStatus is the backend's own record of a pending/
                // accepted/declined friendship, so a request sent in a prior session (or before
                // this modal was last closed and reopened, which resets sentTo) still shows as
                // non-actionable instead of inviting a duplicate send the backend would reject.
                const locallySent = sentTo.has(result.username);
                const label = locallySent
                  ? 'Sent'
                  : RELATIONSHIP_LABELS[result.relationshipStatus] || 'Add';
                const nonActionable = locallySent || !!result.relationshipStatus;
                return (
                  <View key={result.userId} style={styles.resultRow}>
                    <AvatarImage uri={result.photoUrl} name={result.username} size={28} fontSize={12} />
                    <Text style={styles.resultName} numberOfLines={1}>
                      @{result.username}
                    </Text>
                    <Pressable
                      style={[styles.sendButtonSmall, nonActionable && styles.sendButtonSmallDisabled]}
                      disabled={busy || nonActionable}
                      onPress={() => handleSendByUsername(result.username)}
                    >
                      <Text style={styles.sendButtonSmallText}>{label}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </>
          ) : (
            <>
              <Text style={styles.hint}>Enter the email they use to sign in to Habituate.</Text>
              <View style={styles.row}>
                <TextInput
                  style={styles.input}
                  placeholder="friend@example.com"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
                <Pressable style={styles.sendButton} onPress={handleSendByEmail} disabled={busy}>
                  {busy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.sendButtonText}>Send</Text>}
                </Pressable>
              </View>
            </>
          )}

          {pendingRequests.length > 0 ? (
            <>
              <Text style={[styles.label, styles.sectionSpacing]}>Pending requests</Text>
              {pendingRequests.map((request) => (
                <View key={request.id} style={styles.requestRow}>
                  <AvatarImage
                    uri={request.otherUserPhotoUrl}
                    name={request.otherUserName || request.otherUserEmail}
                    size={28}
                    fontSize={12}
                  />
                  <Text style={[styles.requestName, { marginLeft: spacing.sm }]} numberOfLines={1}>
                    {request.otherUserName || request.otherUserEmail}
                  </Text>
                  <View style={styles.requestActions}>
                    <Pressable onPress={() => handleRespond(request, false)} disabled={busy} hitSlop={8}>
                      <MaterialCommunityIcons name="close" size={20} color={colors.textMuted} />
                    </Pressable>
                    <Pressable onPress={() => handleRespond(request, true)} disabled={busy} hitSlop={8}>
                      <MaterialCommunityIcons name="check-circle" size={22} color={colors.safe} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
      <FriendProfileModal
        visible={!!profileUserId}
        userId={profileUserId}
        onClose={() => setProfileUserId(null)}
      />
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
    label: { ...typography.label, marginBottom: spacing.sm },
    modeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    modePill: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: colors.background,
    },
    modePillActive: { backgroundColor: colors.accentSoft },
    modePillText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    modePillTextActive: { color: colors.accent },
    hint: { ...typography.meta, marginBottom: spacing.md },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    searchSpinner: { marginLeft: -spacing.xl, marginRight: spacing.xs },
    input: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      fontSize: 15,
      color: colors.textPrimary,
    },
    sendButton: {
      backgroundColor: colors.accent,
      borderRadius: radii.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm + 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      marginTop: spacing.sm,
      ...shadow,
    },
    resultName: { flex: 1, fontSize: 14, color: colors.textPrimary },
    sendButtonSmall: {
      backgroundColor: colors.accent,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
    },
    sendButtonSmallDisabled: { backgroundColor: colors.border },
    sendButtonSmallText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
    sectionSpacing: { marginTop: spacing.xl },
    requestRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      marginBottom: spacing.sm,
      ...shadow,
    },
    requestName: { flex: 1, fontSize: 14, color: colors.textPrimary, marginRight: spacing.sm },
    requestActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  });
}
