import React, { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { fonts, radii, shadowLg, spacing } from '../theme';

/**
 * Replaces Alert.alert's destructive-confirmation pattern (title, message,
 * Cancel + a destructive/primary action) with this app's own visual
 * language instead of the OS's native dialog — see Toast.js's comment for
 * why that matters (same reasoning, for the blocking-choice case instead of
 * the ephemeral-notice case).
 *
 * Pair with useConfirm(): `const ok = await confirm({ title, message,
 * confirmLabel, destructive });` then render
 * `<ConfirmModal request={request} onRespond={respond} />` once nearby.
 */
export default function ConfirmModal({ request, onRespond }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);

  return (
    <Modal visible={!!request} transparent animationType="fade" onRequestClose={() => onRespond(false)}>
      <Pressable style={styles.backdrop} onPress={() => onRespond(false)}>
        <Pressable style={styles.card} onPress={() => {}}>
          {request?.destructive ? (
            <View style={[styles.iconTile, { backgroundColor: colors.atRiskSoft }]}>
              <MaterialCommunityIcons name="alert-outline" size={22} color={colors.atRisk} />
            </View>
          ) : null}
          <Text style={styles.title}>{request?.title}</Text>
          {request?.message ? <Text style={styles.message}>{request.message}</Text> : null}

          <View style={styles.buttonRow}>
            <Pressable style={styles.cancelBtn} onPress={() => onRespond(false)}>
              <Text style={styles.cancelText}>{request?.cancelLabel || 'Cancel'}</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, { backgroundColor: request?.destructive ? colors.atRisk : colors.accent }]}
              onPress={() => onRespond(true)}
            >
              <Text style={styles.confirmText}>{request?.confirmLabel || 'OK'}</Text>
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
      width: 44,
      height: 44,
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
    },
    buttonRow: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
    cancelBtn: {
      flex: 1,
      paddingVertical: spacing.sm + 2,
      borderRadius: radii.pill,
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    cancelText: { fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary },
    confirmBtn: {
      flex: 1,
      paddingVertical: spacing.sm + 2,
      borderRadius: radii.pill,
      alignItems: 'center',
    },
    confirmText: { fontFamily: fonts.bold, fontSize: 14, color: '#FFFFFF' },
  });
}
