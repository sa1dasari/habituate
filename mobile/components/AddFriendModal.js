import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../api/client';
import AvatarImage from './AvatarImage';
import { useAppTheme } from '../hooks/useAppTheme';
import { useFriends } from '../hooks/useFriends';
import { radii, shadow, spacing } from '../theme';

const SEARCH_DEBOUNCE_MS = 350;

const MODE_OPTIONS = [
  { value: 'username', label: 'By username' },
  { value: 'email', label: 'By email' },
];

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
  const { pendingRequests, busy, sendRequest, sendRequestByUsername, acceptRequest, declineRequest } = useFriends();
  const [mode, setMode] = useState('username');
  const [email, setEmail] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sentTo, setSentTo] = useState(() => new Set());
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setSentTo(new Set());
    }
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
    const ok = await sendRequestByUsername(username);
    if (ok) {
      setSentTo((current) => new Set(current).add(username));
    } else {
      Alert.alert("Couldn't send that", 'Something went wrong — try again.');
    }
  };

  const handleSendByEmail = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert('Enter an email', "Your friend's account email, same as they sign in with.");
      return;
    }
    const ok = await sendRequest(trimmed);
    if (ok) {
      setEmail('');
      Alert.alert('Request sent', "They'll see it next time they open Habituate.");
    } else {
      Alert.alert("Couldn't send that", 'Check the email is right and that an account exists for it.');
    }
  };

  const handleRespond = async (request, accept) => {
    const ok = accept ? await acceptRequest(request.id) : await declineRequest(request.id);
    if (!ok) Alert.alert('Something went wrong', 'Try again.');
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

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.label}>Add a friend</Text>

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
                const alreadySent = sentTo.has(result.username);
                return (
                  <View key={result.userId} style={styles.resultRow}>
                    <AvatarImage uri={result.photoUrl} name={result.username} size={28} fontSize={12} />
                    <Text style={styles.resultName} numberOfLines={1}>
                      @{result.username}
                    </Text>
                    <Pressable
                      style={[styles.sendButtonSmall, alreadySent && styles.sendButtonSmallDisabled]}
                      disabled={busy || alreadySent}
                      onPress={() => handleSendByUsername(result.username)}
                    >
                      <Text style={styles.sendButtonSmallText}>{alreadySent ? 'Sent' : 'Add'}</Text>
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
                  <Text style={styles.requestName} numberOfLines={1}>
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
