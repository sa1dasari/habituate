import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { fonts, skylineUI } from '../theme';

/**
 * Shared card for the first-run permission explainers (design-review boards
 * 37 and 38): a centred card over the dimmed skyline with an icon tile, a
 * title, plain-language copy, and an outlined "not now" pill beside an amber
 * "allow" pill. The two callers (PushPermissionModal, LocationPermissionModal)
 * own the copy and the permission logic; this only owns the look.
 */
export default function FirstRunExplainer({
  visible,
  onAllow,
  onDismiss,
  icon,
  iconColor,
  iconBg,
  title,
  message,
  dismissLabel,
  allowLabel,
  testID,
}) {
  const { effectiveMode } = useAppTheme();
  const ui = skylineUI[effectiveMode];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={[styles.card, { backgroundColor: ui.surfaceHigh }]} onPress={() => {}} testID={testID}>
          <View style={[styles.iconTile, { backgroundColor: iconBg }]}>
            <MaterialCommunityIcons name={icon} size={26} color={iconColor} />
          </View>
          <Text style={[styles.title, { color: ui.text }]}>{title}</Text>
          <Text style={[styles.message, { color: ui.muted }]}>{message}</Text>

          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.dismissBtn, { borderColor: ui.muted }]}
              onPress={onDismiss}
              testID={`${testID}-dismiss`}
              accessibilityRole="button"
            >
              <Text style={[styles.dismissText, { color: ui.text }]}>{dismissLabel}</Text>
            </Pressable>
            <Pressable
              style={[styles.allowBtn, { backgroundColor: ui.amber }]}
              onPress={onAllow}
              testID={`${testID}-allow`}
              accessibilityRole="button"
            >
              <Text style={styles.allowText}>{allowLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 7, 18, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: { width: '100%', maxWidth: 380, borderRadius: 28, padding: 22 },
  iconTile: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontFamily: fonts.extraBold, fontSize: 26, lineHeight: 32 },
  message: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, marginTop: 10, marginBottom: 22 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  dismissBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissText: { fontFamily: fonts.bold, fontSize: 16 },
  allowBtn: { flex: 1.4, minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  allowText: { fontFamily: fonts.bold, fontSize: 16, color: '#1A1300' },
});
