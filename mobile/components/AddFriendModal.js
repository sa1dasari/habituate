import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { useFriends } from '../hooks/useFriends';
import { radii, shadow, spacing } from '../theme';

/**
 * The UI half of a friend-request system whose backend already existed
 * (FriendshipController/useFriends) but had no entry point anywhere in the
 * app — this is what "invite a friend" on a Shared Habit was silently
 * depending on and never finding.
 */
export default function AddFriendModal({ visible, onClose }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { pendingRequests, busy, sendRequest, acceptRequest, declineRequest } = useFriends();
  const [email, setEmail] = useState('');

  const handleSend = async () => {
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
            <Pressable style={styles.sendButton} onPress={handleSend} disabled={busy}>
              {busy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.sendButtonText}>Send</Text>}
            </Pressable>
          </View>

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
    label: { ...typography.label, marginBottom: spacing.xs },
    hint: { ...typography.meta, marginBottom: spacing.md },
    row: { flexDirection: 'row', gap: spacing.sm },
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
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
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
