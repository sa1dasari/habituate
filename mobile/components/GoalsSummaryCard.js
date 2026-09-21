import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii, shadow, spacing, typography } from '../theme';

/**
 * A compact, tap-through summary of every goal (habit-linked and freeform) —
 * shown on Today so goal progress is visible without duplicating the full
 * cards there. Tapping it jumps to the Goals section on the Habits page.
 */
export default function GoalsSummaryCard({ items = [], onPress }) {
  if (items.length === 0) return null;

  const completed = items.filter((item) => item.complete).length;
  const needsReview = items.filter((item) => item.needsReview).length;
  // Average of each goal's own progress, not just how many are fully done —
  // otherwise the bar reads as empty even after real progress is logged.
  const percent = Math.round(
    items.reduce((sum, item) => sum + (item.percent || 0), 0) / items.length
  );

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open Goals"
    >
      <View style={styles.row}>
        <View style={styles.iconTile}>
          <MaterialCommunityIcons name="flag-checkered" size={20} color={colors.accent} />
        </View>

        <View style={styles.text}>
          <Text style={styles.title}>Goals</Text>
          <Text style={styles.subtitle}>
            {completed} of {items.length} completed · {percent}% avg. progress
            {needsReview > 0 ? ` · ${needsReview} to review` : ''}
          </Text>
        </View>

        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
      </View>

      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${percent}%` }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...shadow,
  },
  cardPressed: {
    opacity: 0.9,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  text: {
    flex: 1,
  },
  title: {
    ...typography.cardTitle,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  barTrack: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.ringTrack,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  barFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
});
