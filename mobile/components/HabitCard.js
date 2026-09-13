import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import StreakIndicator from './StreakIndicator';
import { colors, radii, shadow, spacing, typography } from '../theme';

const CADENCE_LABEL = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
};

/**
 * The habit row used on Today and Habits. The check control is a circular
 * target on the right: filled when done, a neutral outline when not.
 * An un-checked habit is never styled as a failure.
 */
export default function HabitCard({
  name = 'Habit name',
  category = 'General',
  cadenceType = 'DAILY',
  streak = 0,
  streakStatus = 'safe',
  checked = false,
  disabled = false,
  onToggle,
  onPress,
}) {
  const cadence = CADENCE_LABEL[String(cadenceType).toUpperCase()] || 'Daily';

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && onPress ? styles.cardPressed : null]}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <View style={styles.main}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{category}</Text>
          </View>
          <Text style={styles.cadence}>{cadence}</Text>
        </View>

        <View style={styles.streakRow}>
          <StreakIndicator streak={streak} status={streakStatus} compact />
        </View>
      </View>

      <Pressable
        onPress={onToggle}
        disabled={disabled}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={checked ? `Undo check-in for ${name}` : `Check in ${name}`}
        style={({ pressed }) => [
          styles.check,
          checked ? styles.checkOn : styles.checkOff,
          pressed && !disabled ? styles.checkPressed : null,
          disabled ? styles.checkDisabled : null,
        ]}
      >
        <MaterialCommunityIcons
          name="check"
          size={22}
          color={checked ? '#FFFFFF' : colors.textMuted}
        />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    ...shadow,
  },
  cardPressed: {
    opacity: 0.9,
  },
  main: {
    flex: 1,
  },
  name: {
    ...typography.cardTitle,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs + 2,
  },
  chip: {
    backgroundColor: colors.background,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  cadence: {
    fontSize: 12,
    color: colors.textMuted,
  },
  streakRow: {
    marginTop: spacing.sm,
  },
  check: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOff: {
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  checkOn: {
    backgroundColor: colors.safe,
  },
  checkPressed: {
    opacity: 0.7,
  },
  checkDisabled: {
    opacity: 0.5,
  },
});
