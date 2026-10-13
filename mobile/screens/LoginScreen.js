import React, { useMemo, useState } from 'react';
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
import { AppleAuthenticationButton, AppleAuthenticationButtonStyle, AppleAuthenticationButtonType } from 'expo-apple-authentication';
import { useAuth } from '../hooks/useAuth';
import { useAppTheme } from '../hooks/useAppTheme';
import { radii, spacing } from '../theme';

export default function LoginScreen({ onGoToSignup }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const {
    signIn,
    signInWithGoogle,
    signInWithFacebook,
    signInWithApple,
    signInWithBiometrics,
    error,
    googleLoading,
    facebookLoading,
    appleLoading,
    appleAvailable,
    biometricLoading,
    biometricAvailable,
    biometricLabel,
    clearError,
  } = useAuth();
  const anyOauthLoading = googleLoading || facebookLoading || appleLoading || biometricLoading;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    if (!email.trim() || !password) return;
    clearError();
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      // AuthProvider's onAuthStateChanged will update user → App.js re-renders to tabs
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
            <Text style={styles.tagline}>Build habits that stick — together.</Text>
          </View>

          <View style={styles.form}>
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
              onSubmitEditing={handleSignIn}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              style={[styles.button, (loading || anyOauthLoading) && styles.buttonDisabled]}
              onPress={handleSignIn}
              disabled={loading || anyOauthLoading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Sign in</Text>
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
              disabled={loading || anyOauthLoading}
            >
              {googleLoading ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Text style={styles.googleButtonText}>Sign in with Google</Text>
              )}
            </Pressable>

            <Pressable
              style={[styles.googleButton, facebookLoading && styles.buttonDisabled]}
              onPress={signInWithFacebook}
              disabled={loading || anyOauthLoading}
            >
              {facebookLoading ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Text style={styles.googleButtonText}>Continue with Facebook</Text>
              )}
            </Pressable>

            {appleAvailable ? (
              <AppleAuthenticationButton
                buttonType={AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={radii.md}
                style={styles.appleButton}
                onPress={signInWithApple}
              />
            ) : null}

            {biometricAvailable ? (
              <Pressable
                style={[styles.googleButton, biometricLoading && styles.buttonDisabled]}
                onPress={signInWithBiometrics}
                disabled={loading || anyOauthLoading}
              >
                {biometricLoading ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <Text style={styles.googleButtonText}>Sign in with {biometricLabel}</Text>
                )}
              </Pressable>
            ) : null}

            <Pressable style={styles.switchLink} onPress={onGoToSignup}>
              <Text style={styles.switchText}>
                New here?{' '}
                <Text style={styles.switchAction}>Create an account</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors, typography) {
  return StyleSheet.create({
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
  appleButton: { height: 48, marginTop: spacing.sm },
    switchLink: { alignItems: 'center', marginTop: spacing.lg },
    switchText: { ...typography.body, color: colors.textSecondary },
    switchAction: { color: colors.accent, fontWeight: '600' },
  });
}
