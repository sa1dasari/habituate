import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fonts } from '../theme';

/**
 * Bottom sheet for the two cap notices (design-review boards 52 and 55): a
 * crown tile, a title, a few lines of copy, an amber primary button and a
 * plain text secondary. The skyline stays visible (dimmed) above it.
 * Dismissing by tapping outside is the secondary action, so a swipe-away
 * never leaves a notice half-handled.
 */
export default function TopOutNoticeSheet({
  visible,
  title,
  body,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  busy,
  theme,
  testID,
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onSecondary}>
      <Pressable style={styles.backdrop} onPress={onSecondary} testID={`${testID}-backdrop`}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.surfaceHigh }]} onPress={() => {}} testID={testID}>
          <View style={[styles.handle, { backgroundColor: theme.muted }]} />
          <View style={[styles.iconTile, { backgroundColor: `${theme.amber}26` }]}>
            <MaterialCommunityIcons name="crown-outline" size={30} color={theme.amber} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.body, { color: theme.muted }]}>{body}</Text>

          <Pressable
            onPress={onPrimary}
            disabled={busy}
            style={[styles.primary, { backgroundColor: theme.amber, opacity: busy ? 0.6 : 1 }]}
            testID={`${testID}-primary`}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>{primaryLabel}</Text>
          </Pressable>
          <Pressable
            onPress={onSecondary}
            disabled={busy}
            style={styles.secondary}
            testID={`${testID}-secondary`}
            accessibilityRole="button"
          >
            <Text style={[styles.secondaryText, { color: theme.text }]}>{secondaryLabel}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(4, 7, 18, 0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 20 },
  iconTile: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontFamily: fonts.extraBold, fontSize: 26, lineHeight: 32 },
  body: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 26, marginTop: 10, marginBottom: 22 },
  primary: { minHeight: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: fonts.bold, fontSize: 18, color: '#1A1300' },
  secondary: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  secondaryText: { fontFamily: fonts.bold, fontSize: 17 },
});
