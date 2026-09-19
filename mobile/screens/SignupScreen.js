import React, { useState } from 'react';
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
import { useAuth } from '../hooks/useAuth';
import { colors, radii, spacing, typography } from '../theme';

export default function SignupScreen({ onGoToLogin }) {
  const { signUp, signInWithGoogle, error, googleLoading, clearError } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    if (!email.trim() || !password) return;
    clearError();
    setLoading(true);
    try {
      await signUp(email.trim(), password, name.trim() || undefined);
      // onAuthStateChanged fires → App.js shows tabs
    } catch {
      // error is set in useAuth
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.wordmark}>habituate</Text>
            <Text style={styles.tagline}>Start building — no pressure.</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Name (optional)</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="next"
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="next"
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleSignUp}
              placeholder="At least 6 characters"
              placeholderTextColor={colors.textMuted}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              style={[styles.button, (loading || googleLoading) && styles.buttonDisabled]}
              onPress={handleSignUp}
              disabled={loading || googleLoading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Create account</Text>
              )}
            </Pressable>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              style={[styles.googleButton, googleLoading && styles.buttonDisabled]}
              onPress={signInWithGoogle}
              disabled={googleLoading || loading}
            >
              {googleLoading ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Text style={styles.googleButtonText}>Sign up with Google</Text>
              )}
            </Pressable>

            <Pressable style={styles.switchLink} onPress={onGoToLogin}>
              <Text style={styles.switchText}>
                Already have an account?{' '}
                <Text style={styles.switchAction}>Sign in</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  header: { alignItems: 'center', marginBottom: spacing.xxl },
  wordmark: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: -1,
  },
  tagline: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  form: { gap: spacing.sm },
  label: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: 2,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    minHeight: 48,
  },
  errorText: {
    color: colors.atRisk,
    fontSize: 14,
    marginTop: spacing.xs,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.meta, marginHorizontal: spacing.md, color: colors.textMuted },
  googleButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  googleButtonText: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  switchLink: { alignItems: 'center', marginTop: spacing.lg },
  switchText: { ...typography.body, color: colors.textSecondary },
  switchAction: { color: colors.accent, fontWeight: '600' },
});
