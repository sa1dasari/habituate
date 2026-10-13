import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { spacing } from '../theme';

/**
 * Back-chevron + centered title + spacer, matching EditProfileModal's header
 * bar exactly — every screen in this app builds its own header rather than
 * relying on React Navigation's native header bar, so the new Account
 * Settings stack (all headerShown:false) follows the same convention instead
 * of mixing two header styles in one stack.
 */
export default function StackHeader({ title, onBack }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);

  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
        <MaterialCommunityIcons name="chevron-left" size={26} color={colors.textSecondary} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={{ width: 34 }} />
    </View>
  );
}

function makeStyles(colors, typography) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { ...typography.sectionTitle, flex: 1, textAlign: 'center' },
    backBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  });
}
