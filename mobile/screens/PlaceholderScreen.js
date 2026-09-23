import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../hooks/useAppTheme';
import { radii, shadow, spacing } from '../theme';

/**
 * Honest placeholder for screens whose phase hasn't been built yet, so the
 * navigation spine is complete without pretending the page exists.
 */
export default function PlaceholderScreen({ title, phase, summary, items = [] }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{title}</Text>

        <View style={styles.card}>
          <Text style={styles.phase}>{phase}</Text>
          <Text style={styles.summary}>{summary}</Text>

          {items.map((item) => (
            <View key={item} style={styles.itemRow}>
              <View style={styles.bullet} />
              <Text style={styles.itemText}>{item}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors, typography) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    container: { padding: spacing.xl },
    title: { ...typography.screenTitle, marginBottom: spacing.lg },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      ...shadow,
    },
    phase: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.accent,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    summary: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
    itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
    bullet: { width: 5, height: 5, borderRadius: radii.pill, backgroundColor: colors.textMuted },
    itemText: { flex: 1, fontSize: 13, color: colors.textSecondary },
  });
}
