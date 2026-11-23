import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { fonts, spacing } from '../theme';

/**
 * Lean-v1 stand-in for the real CommunityScreen (SKYLINE.md Phase 8a,
 * section 14 #21, revised 2026-11-23): the Community tab stays in the tab
 * bar — unlike the coach entry points, which are just removed — but
 * tapping it shows this instead of the real screen until v2. Swapped back
 * via COMMUNITY_ENABLED in App.js; CommunityScreen itself is untouched.
 */
export default function CommunityComingSoonScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <MaterialCommunityIcons name="account-group-outline" size={48} color={colors.textMuted} />
        <Text style={styles.title}>Community is on its way</Text>
        <Text style={styles.body}>
          Building together and raising landmarks with friends are coming in a future update. For now, focus on your
          own skyline.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      gap: spacing.sm,
    },
    title: {
      fontFamily: fonts.extraBold,
      fontSize: 18,
      color: colors.textPrimary,
      textAlign: 'center',
      marginTop: spacing.md,
    },
    body: {
      fontFamily: fonts.regular,
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
}
