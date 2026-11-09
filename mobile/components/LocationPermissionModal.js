import React, { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { fonts, radii, shadowLg, spacing } from '../theme';

/**
 * One-time, plain-language explainer shown before the OS location-permission
 * dialog — SKYLINE.md section 5: "asked once, after the user's first floor,
 * with a plain-language explainer first." Same shape as PushPermissionModal
 * (backdrop + card + two-button row), fired by SkylineScreen right after a
 * successful hold, not on mount.
 */
export default function LocationPermissionModal({ visible, onAllow, onDismiss }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={[styles.iconTile, { backgroundColor: colors.accentSoft }]}>
            <MaterialCommunityIcons name="weather-partly-cloudy" size={24} color={colors.accent} />
          </View>
          <Text style={styles.title}>Match your sky to your weather</Text>
          <Text style={styles.message}>
            With your approximate location, your skyline's sky can show real clouds, rain or snow —
            not just the clock. It's never shown precisely, never shared, and stays on this device.
            Skip and the sky still follows the time of day.
          </Text>

          <View style={styles.buttonRow}>
            <Pressable style={styles.dismissBtn} onPress={onDismiss}>
              <Text style={styles.dismissText}>Skip</Text>
            </Pressable>
            <Pressable style={[styles.allowBtn, { backgroundColor: colors.accent }]} onPress={onAllow}>
              <Text style={styles.allowText}>Allow location</Text>
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
