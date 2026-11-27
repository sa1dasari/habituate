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
import { Ionicons } from '@expo/vector-icons';
import { AppleAuthenticationButton, AppleAuthenticationButtonStyle, AppleAuthenticationButtonType } from 'expo-apple-authentication';
import GoogleIcon from '../components/GoogleIcon';
import { useAuth } from '../hooks/useAuth';
import { useAppTheme } from '../hooks/useAppTheme';
import { fonts, radii, skylineUI, spacing } from '../theme';

// Boards 93/93-light (design/skyline/, owner-approved 2026-11-25): full-screen,
// no skyline hero, no card — see design/skyline/README.md's "Login and
// Create account" section for the full spec this follows.
export default function SignupScreen({ onGoToLogin }) {
  const { colors, effectiveMode } = useAppTheme();
  const ui = skylineUI[effectiveMode];
  const buttonTextColor = effectiveMode === 'dark' ? '#15202B' : '#FFFFFF';
  const styles = useMemo(() => makeStyles(ui, colors, effectiveMode), [ui, colors, effectiveMode]);
  const {
    signUp,
    signInWithGoogle,
    signInWithFacebook,
    signInWithApple,
    error,
    googleLoading,
    facebookLoading,
    appleLoading,
    appleAvailable,
    clearError,
  } = useAuth();
  const anyOauthLoading = googleLoading || facebookLoading || appleLoading;
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
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View>
            <View style={styles.header}>
              <Text style={styles.wordmark}>habituate</Text>
              <Text style={styles.tagline}>Build habits that stick, together.</Text>
            </View>

            <View style={styles.form}>
              <Text style={styles.heading}>Create your account</Text>

              <Text style={styles.label}>Name (optional)</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                returnKeyType="next"
                placeholder="Your name"
                placeholderTextColor={ui.muted}
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
                placeholderTextColor={ui.muted}
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
                placeholderTextColor={ui.muted}
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Pressable
                style={[styles.button, (loading || anyOauthLoading) && styles.buttonDisabled]}
                onPress={handleSignUp}
                disabled={loading || anyOauthLoading}
              >
                {loading ? (
                  <ActivityIndicator color={buttonTextColor} />
                ) : (
                  <Text style={styles.buttonText}>Create account</Text>
                )}
              </Pressable>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or continue with</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.socialRow}>
                <Pressable
                  style={[styles.pill, googleLoading && styles.buttonDisabled]}
                  onPress={signInWithGoogle}
                  disabled={loading || anyOauthLoading}
                  accessibilityRole="button"
                  accessibilityLabel="Sign up with Google"
                >
                  {googleLoading ? (
                    <ActivityIndicator color={ui.text} />
                  ) : (
                    <>
                      <GoogleIcon size={18} />
                      <Text style={styles.pillText} numberOfLines={1} ellipsizeMode="tail">
                        Google
                      </Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  style={[styles.pill, facebookLoading && styles.buttonDisabled]}
                  onPress={signInWithFacebook}
                  disabled={loading || anyOauthLoading}
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Facebook"
                >
                  {facebookLoading ? (
                    <ActivityIndicator color={ui.text} />
                  ) : (
                    <>
                      <Ionicons name="logo-facebook" size={18} color="#1877F2" />
                      <Text style={styles.pillText} numberOfLines={1} ellipsizeMode="tail">
                        Facebook
                      </Text>
                    </>
                  )}
                </Pressable>

                {appleAvailable ? (
                  <AppleAuthenticationButton
                    buttonType={AppleAuthenticationButtonType.SIGN_UP}
                    buttonStyle={AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={24}
                    style={styles.appleButton}
                    onPress={signInWithApple}
                  />
                ) : null}
              </View>
            </View>
          </View>

          <Pressable style={styles.switchLink} onPress={onGoToLogin}>
            <Text style={styles.switchText}>
              Already have an account? <Text style={styles.switchAction}>Sign in</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(ui, colors, effectiveMode) {
  const isDark = effectiveMode === 'dark';
  const inputBg = isDark ? ui.surfaceHigh : ui.surfaceLow;
  // Light-mode border reuses ui.muted rather than a paler gray — a paler
  // border measures under 3:1 against ui.background (#EAF0F7), the WCAG
  // non-text-contrast bar for an interactive control's boundary, and ui.muted
  // clears it comfortably (~4.8:1). Dark mode's low-alpha hairline matches the
  // approved board's own subtle divider and isn't changed.
  const inputBorder = isDark ? 'transparent' : ui.muted;
  const hairline = isDark ? 'rgba(255,255,255,0.12)' : ui.muted;
  const buttonTextColor = isDark ? '#15202B' : '#FFFFFF';

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: ui.background },
    flex: { flex: 1 },
    container: {
      flexGrow: 1,
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xxl,
      paddingBottom: spacing.xl,
    },
    header: { marginBottom: 40 },
    wordmark: {
      fontFamily: fonts.extraBold,
      fontSize: 36,
      color: ui.text,
      letterSpacing: -1,
    },
    tagline: {
      fontFamily: fonts.regular,
      fontSize: 16,
      color: ui.muted,
      marginTop: spacing.xs,
    },
    form: { gap: spacing.sm },
    heading: {
      fontFamily: fonts.extraBold,
      fontSize: 22,
      color: ui.text,
      marginBottom: spacing.sm,
    },
    label: {
      fontFamily: fonts.semiBold,
      fontSize: 13,
      color: ui.muted,
      marginBottom: 2,
      marginTop: spacing.sm,
    },
    input: {
      backgroundColor: inputBg,
      borderWidth: 1,
      borderColor: inputBorder,
      borderRadius: radii.lg,
      height: 56,
      paddingHorizontal: spacing.lg,
      fontFamily: fonts.regular,
      fontSize: 16,
      color: ui.text,
    },
    errorText: {
      fontFamily: fonts.regular,
      fontSize: 12,
      color: colors.atRisk,
      marginTop: spacing.xs,
    },
    button: {
      backgroundColor: ui.amber,
      borderRadius: radii.pill,
      height: 54,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.md,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { fontFamily: fonts.extraBold, fontSize: 16, color: buttonTextColor },
    divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg },
    dividerLine: { flex: 1, height: 1, backgroundColor: hairline },
    dividerText: {
      fontFamily: fonts.regular,
      fontSize: 12,
      marginHorizontal: spacing.md,
      color: ui.muted,
    },
    socialRow: { flexDirection: 'row', gap: spacing.sm },
    pill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      height: 48,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: hairline,
      backgroundColor: 'transparent',
    },
    pillText: { fontFamily: fonts.semiBold, fontSize: 14, color: ui.text },
    appleButton: { flex: 1, height: 48 },
    switchLink: { alignItems: 'center', justifyContent: 'center', minHeight: 48, paddingTop: spacing.sm },
    switchText: { fontFamily: fonts.regular, fontSize: 14, color: ui.muted },
    switchAction: { fontFamily: fonts.bold, color: ui.amber },
  });
}
