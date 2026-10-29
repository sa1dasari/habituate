import React, { useMemo } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ConfirmModal from '../components/ConfirmModal';
import StackHeader from '../components/StackHeader';
import Toast from '../components/Toast';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAuth } from '../hooks/useAuth';
import { useConfirm } from '../hooks/useConfirm';
import { useToast } from '../hooks/useToast';
import { labelForProviderId } from '../utils/providerLabels';
import { radii, shadow, spacing } from '../theme';

const PROVIDERS = [
  { providerId: 'password', providerType: null, icon: 'email-outline' },
  { providerId: 'google.com', providerType: 'google', icon: 'google' },
  { providerId: 'facebook.com', providerType: 'facebook', icon: 'facebook' },
  { providerId: 'apple.com', providerType: 'apple', icon: 'apple' },
];

export default function LoginSecurityScreen({ navigation }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const {
    user,
    error,
    clearError,
    linkProvider,
    unlinkProvider,
    linking,
    appleAvailable,
    sendPasswordReset,
    deleteAccount,
    deletingAccount,
    signOut,
  } = useAuth();

  const { toast, showToast, hideToast } = useToast();
  const { request, confirm, respond } = useConfirm();

  const providerData = user?.providerData || [];
  const linkedIds = new Set(providerData.map((p) => p.providerId));
  const isPasswordAccount = linkedIds.has('password');

  const handleLink = (providerType) => {
    clearError();
    linkProvider(providerType);
  };

  const handleUnlink = async (providerId) => {
    const ok = await confirm({
      title: `Unlink ${labelForProviderId(providerId)}?`,
      message: 'You can link it again later from here.',
      confirmLabel: 'Unlink',
      destructive: true,
    });
    if (!ok) return;
    clearError();
    unlinkProvider(providerId);
  };

  const handleResetPassword = async () => {
    const ok = await confirm({
      title: 'Reset password?',
      message: `We'll email a reset link to ${user?.email}.`,
      confirmLabel: 'Send email',
    });
    if (!ok) return;
    try {
      await sendPasswordReset();
      showToast('Check your inbox for the password reset link.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't send it — something went wrong.", 'error');
    }
  };

  const handleDeleteAccount = async () => {
    const ok = await confirm({
      title: 'Delete account?',
      message: "This permanently deletes your account and everything in it — habits, check-ins, goals, and shared groups or challenges you created. This can't be undone.",
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteAccount();
      await signOut();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't delete account — something went wrong.", 'error');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StackHeader title="Login & Security" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.sectionTitle}>Sign-in methods</Text>
        <Text style={styles.sectionNote}>
          Link multiple sign-in methods so you always land on the same account, no matter how you sign in.
        </Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.card}>
          {PROVIDERS.filter((p) => p.providerId !== 'apple.com' || (Platform.OS === 'ios' && appleAvailable)).map(
            (provider, index, arr) => {
              const linked = linkedIds.has(provider.providerId);
              const isLast = index === arr.length - 1;
              return (
                <View key={provider.providerId} style={[styles.row, isLast && styles.rowLast]}>
                  <View style={styles.rowIcon}>
                    <MaterialCommunityIcons name={provider.icon} size={18} color={colors.accent} />
                  </View>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowLabel}>{labelForProviderId(provider.providerId)}</Text>
                    <Text style={styles.rowMeta}>{linked ? 'Linked' : 'Not linked'}</Text>
                  </View>
                  {linking ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : linked ? (
                    provider.providerId === 'password' ? null : (
                      <Pressable onPress={() => handleUnlink(provider.providerId)}>
                        <Text style={styles.unlinkText}>Unlink</Text>
                      </Pressable>
                    )
                  ) : provider.providerType ? (
                    <Pressable onPress={() => handleLink(provider.providerType)}>
                      <Text style={styles.linkText}>Link</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            }
          )}
        </View>

        {isPasswordAccount ? (
          <Pressable style={styles.secondaryButton} onPress={handleResetPassword}>
            <MaterialCommunityIcons name="lock-reset" size={16} color={colors.textSecondary} />
            <Text style={styles.secondaryButtonText}>Reset password</Text>
          </Pressable>
        ) : null}

        <Text style={styles.sectionTitle}>Danger zone</Text>
        <Pressable
          style={[styles.deleteButton, deletingAccount && styles.deleteButtonDisabled]}
          onPress={handleDeleteAccount}
          disabled={deletingAccount}
        >
          {deletingAccount ? (
            <ActivityIndicator color={colors.atRisk} />
          ) : (
            <>
              <MaterialCommunityIcons name="delete-outline" size={16} color={colors.atRisk} />
              <Text style={styles.deleteButtonText}>Delete account</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
      <Toast toast={toast} onHide={hideToast} />
      <ConfirmModal request={request} onRespond={respond} />
    </SafeAreaView>
  );
}

function makeStyles(colors, typography) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    container: { padding: spacing.lg, paddingBottom: spacing.xxl },
    sectionTitle: { ...typography.sectionTitle, marginBottom: spacing.xs, marginTop: spacing.lg },
    sectionNote: { ...typography.meta, marginBottom: spacing.md },
    errorText: { color: colors.atRisk, fontSize: 14, marginBottom: spacing.md },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      ...shadow,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowLast: { borderBottomWidth: 0 },
    rowIcon: {
      width: 32,
      height: 32,
      borderRadius: radii.md,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowInfo: { flex: 1 },
    rowLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
    rowMeta: { ...typography.meta, marginTop: 1 },
    linkText: { fontSize: 13, fontWeight: '700', color: colors.accent },
    unlinkText: { fontSize: 13, fontWeight: '700', color: colors.atRisk },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: colors.surface,
      borderRadius: radii.pill,
      paddingVertical: spacing.sm + 2,
      marginTop: spacing.lg,
      ...shadow,
    },
    secondaryButtonText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderWidth: 1,
      borderColor: colors.atRisk,
      borderRadius: radii.pill,
      paddingVertical: spacing.sm + 2,
    },
    deleteButtonDisabled: { opacity: 0.6 },
    deleteButtonText: { fontSize: 14, fontWeight: '700', color: colors.atRisk },
  });
}
