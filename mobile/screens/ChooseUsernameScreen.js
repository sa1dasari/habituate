import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useAppTheme } from '../hooks/useAppTheme';
import { radii, spacing } from '../theme';

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const CHECK_DEBOUNCE_MS = 400;

/**
 * A mandatory, blocking gate shown by App.js whenever the signed-in user's
 * profile has no username yet — every account needs a unique one going
 * forward (it's what makes "find me by username" possible for friend/shared-
 * habit search, instead of only an exact sign-in email). Shown in place of
 * the whole Tabs tree, same "block until done" shape as the login/signup
 * screens before `user` resolves.
 */
export default function ChooseUsernameScreen({ onDone }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { signOut } = useAuth();

  const [value, setValue] = useState('');
  const [status, setStatus] = useState('idle'); // idle | checking | available | taken | invalid
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef(null);

  const normalized = value.trim().toLowerCase();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!normalized) {
      setStatus('idle');
      return;
    }
    if (!USERNAME_PATTERN.test(normalized)) {
      setStatus('invalid');
      return;
    }
    setStatus('checking');
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await api.getUsernameAvailable(normalized);
        setStatus(result?.available ? 'available' : 'taken');
      } catch {
        setStatus('idle');
      }
    }, CHECK_DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [normalized]);

  const handleSubmit = async () => {
    if (status !== 'available') return;
    setSubmitting(true);
    setError('');
    try {
      await api.setUsername(normalized);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const hint = {
    idle: 'Letters, numbers, and underscores — 3 to 20 characters.',
    invalid: 'Letters, numbers, and underscores only, 3 to 20 characters.',
    checking: 'Checking availability…',
    available: 'Available!',
    taken: 'Already taken — try another.',
  }[status];

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.iconBadge}>
            <MaterialCommunityIcons name="at" size={28} color={colors.accent} />
          </View>
          <Text style={styles.title}>Choose a username</Text>
          <Text style={styles.subtitle}>
            Friends can find you by this to add you or share a habit — no need to know your email.
          </Text>

          <View style={styles.inputRow}>
            <Text style={styles.atSign}>@</Text>
            <TextInput
              style={styles.input}
              placeholder="yourname"
              placeholderTextColor={colors.textMuted}
              value={value}
              onChangeText={setValue}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              maxLength={20}
            />
            {status === 'checking' ? <ActivityIndicator size="small" color={colors.accent} /> : null}
            {status === 'available' ? (
              <MaterialCommunityIcons name="check-circle" size={20} color={colors.safe} />
            ) : null}
            {status === 'taken' || status === 'invalid' ? (
              <MaterialCommunityIcons name="close-circle" size={20} color={colors.atRisk} />
            ) : null}
          </View>
          <Text
            style={[
              styles.hint,
              status === 'available' && styles.hintSafe,
              (status === 'taken' || status === 'invalid') && styles.hintError,
            ]}
          >
            {hint}
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            style={[styles.primaryButton, status !== 'available' && styles.primaryButtonDisabled]}
            disabled={status !== 'available' || submitting}
            onPress={handleSubmit}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Continue</Text>
            )}
          </Pressable>

          <Pressable style={styles.signOutButton} onPress={signOut}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors, typography) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    scroll: { flexGrow: 1, padding: spacing.xl, justifyContent: 'center' },
    iconBadge: {
      width: 56,
      height: 56,
      borderRadius: radii.pill,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: spacing.lg,
    },
    title: { ...typography.screenTitle, textAlign: 'center', marginBottom: spacing.sm },
    subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
    },
    atSign: { fontSize: 16, fontWeight: '700', color: colors.textMuted },
    input: { flex: 1, fontSize: 16, color: colors.textPrimary },
    hint: { ...typography.meta, marginTop: spacing.sm, marginBottom: spacing.xl },
    hintSafe: { color: colors.safe },
    hintError: { color: colors.atRisk },
    errorText: { ...typography.meta, color: colors.atRisk, marginBottom: spacing.md },
    primaryButton: {
      backgroundColor: colors.accent,
      borderRadius: radii.pill,
      paddingVertical: spacing.sm + 4,
      alignItems: 'center',
    },
    primaryButtonDisabled: { opacity: 0.5 },
    primaryButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
    signOutButton: { alignItems: 'center', marginTop: spacing.lg },
    signOutText: { ...typography.meta, color: colors.textSecondary },
  });
}
