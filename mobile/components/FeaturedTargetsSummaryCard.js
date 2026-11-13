import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../hooks/useAppTheme';
import { gradients, radii, shadow, spacing } from '../theme';

/**
 * A compact, tap-through summary of every habit's own pinned ("Feature on
 * Goals") weekly/monthly target — shown on Today so that progress is
 * visible without duplicating each habit's full card there. Was
 * GoalsSummaryCard.js, which also folded in the separate freeform Goals
 * feature; that feature was removed (owner decision, 2026-11-13), so this
 * is per-habit featured targets only now. Every featured habit already
 * appears in Today's own list below, so this is display-only unless a
 * caller passes onPress for some other destination.
 */
export default function FeaturedTargetsSummaryCard({ items = [], onPress }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);

  if (items.length === 0) return null;

  const completed = items.filter((item) => item.complete).length;
  const needsReview = items.filter((item) => item.needsReview).length;
  // Average of each target's own progress, not just how many are fully
  // done — otherwise the bar reads as empty even after real progress is logged.
  const percent = Math.round(
    items.reduce((sum, item) => sum + (item.percent || 0), 0) / items.length
  );

  // No onPress, no button role — ChallengeCard.js/SharedHabitCard.js use the
  // same Pressable-or-View split for a card that's sometimes just a display.
  const Container = onPress ? Pressable : View;

  return (
    <Container
      style={onPress ? ({ pressed }) => [styles.card, pressed && styles.cardPressed] : styles.card}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? 'Open featured targets' : undefined}
    >
      <View style={styles.row}>
        <View style={styles.iconTile}>
          <MaterialCommunityIcons name="flag-checkered" size={20} color={colors.accent} />
        </View>

        <View style={styles.text}>
          <Text style={styles.title}>Featured targets</Text>
          <Text style={styles.subtitle}>
            {completed} of {items.length} completed · {percent}% avg. progress
            {needsReview > 0 ? ` · ${needsReview} to review` : ''}
          </Text>
        </View>

        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
      </View>

      <View style={styles.barTrack}>
        <LinearGradient
          colors={gradients.accent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.barFill, { width: `${percent}%` }]}
        />
      </View>
    </Container>
  );
}

function makeStyles(colors, typography) {
  return StyleSheet.create({
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
    },
  });
}
