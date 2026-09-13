import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii, shadow, spacing } from '../theme';

/**
 * "Pattern detected" card.
 *
 * Copy rules (non-negotiable, see CLAUDE.md): the relationship is directional
 * and stated as a conditional frequency — "X% of the time" — never as a cause.
 * The nudge slot carries the concrete, evidence-based suggestion.
 */
export default function InsightCard({
  kind = 'correlation',
  habitA = 'Habit A',
  habitB = 'Habit B',
  matchPercent = 0,
  description,
  nudge,
  sampleSize,
}) {
  const heading = kind === 'streak_risk' ? 'Heads up' : kind === 'trend' ? 'Trend' : 'Pattern detected';
  const percent = Math.max(0, Math.min(100, Math.round(matchPercent || 0)));

  const fallbackDescription = `On days you complete ${habitA}, you also complete ${habitB} ${percent}% of the time.`;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <MaterialCommunityIcons name="chart-timeline-variant" size={16} color={colors.accent} />
        <Text style={styles.heading}>{heading}</Text>
      </View>

      <View style={styles.directionRow}>
        <Text style={styles.habit} numberOfLines={1}>
          {habitA}
        </Text>
        <MaterialCommunityIcons name="arrow-right" size={16} color={colors.textMuted} />
        <Text style={styles.habit} numberOfLines={1}>
          {habitB}
        </Text>
      </View>

      <View style={styles.matchRow}>
        <Text style={styles.matchPercent}>{percent}%</Text>
        <Text style={styles.matchLabel}>match</Text>
        {sampleSize ? <Text style={styles.sample}>· {sampleSize} days of data</Text> : null}
      </View>

      <Text style={styles.description}>{description || fallbackDescription}</Text>

      {nudge ? (
        <View style={styles.nudge}>
          <MaterialCommunityIcons name="lightbulb-outline" size={16} color={colors.safe} />
          <Text style={styles.nudgeText}>{nudge}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  heading: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  directionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  habit: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs + 2,
    marginTop: spacing.sm,
  },
  matchPercent: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  matchLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  sample: {
    fontSize: 12,
    color: colors.textMuted,
  },
  description: {
    marginTop: spacing.sm,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  nudge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.safeSoft,
  },
  nudgeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: colors.safe,
    fontWeight: '600',
  },
});
