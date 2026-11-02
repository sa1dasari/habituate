import React, { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { fonts, radii, shadowLg, spacing } from '../theme';

/**
 * One-time, in-app explainer shown before the OS push-permission dialog —
 * see usePushPermissionPrompt (hooks/usePushToken.js) for why: framing the
 * value first measurably improves opt-in versus letting the bare system
 * prompt be a user's first signal. Same visual shape as ConfirmModal
 * (backdrop + card + two-button row) but with a dedicated icon tile and
 * benefit-led copy instead of a confirm/cancel question.
 */
export default function PushPermissionModal({ visible, onAllow, onDismiss }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={[styles.iconTile, { backgroundColor: colors.accentSoft }]}>
            <MaterialCommunityIcons name="bell-ring-outline" size={24} color={colors.accent} />
          </View>
          <Text style={styles.title}>Stay on track</Text>
          <Text style={styles.message}>
            Get a gentle reminder right when it's time for a habit — no spam, just the nudges you set up yourself.
            You can turn any of this off later in Notification Settings.
          </Text>

          <View style={styles.buttonRow}>
            <Pressable style={styles.dismissBtn} onPress={onDismiss}>
              <Text style={styles.dismissText}>Not now</Text>
            </Pressable>
            <Pressable style={[styles.allowBtn, { backgroundColor: colors.accent }]} onPress={onAllow}>
              <Text style={styles.allowText}>Allow notifications</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(colors, typography) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(8, 10, 16, 0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      alignItems: 'center',
      ...shadowLg,
    },
    iconTile: {
      width: 48,
      height: 48,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    title: {
      ...typography.cardTitle,
      textAlign: 'center',
      marginBottom: spacing.xs,
    },
    message: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.lg,
      lineHeight: 20,
    },
    buttonRow: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
    dismissBtn: {
      flex: 1,
      minHeight: 44,
      paddingVertical: spacing.sm + 2,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    dismissText: { fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary },
    allowBtn: {
      flex: 1.3,
      minHeight: 44,
      paddingVertical: spacing.sm + 2,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    allowText: { fontFamily: fonts.bold, fontSize: 14, color: '#FFFFFF' },
  });
}
