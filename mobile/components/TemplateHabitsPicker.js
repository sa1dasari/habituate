import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { categoryIcon } from '../constants/habitCategories';
import { useAppTheme } from '../hooks/useAppTheme';
import { radii, spacing } from '../theme';

/**
 * A first-time user's fastest path to a real habit — tapping one of these
 * creates it immediately with sensible defaults (name/category only; plain
 * once-a-day tracking, no targets/reminder) instead of making them fill out
 * the full create form from a blank slate. Shown only on Today's empty
 * state (not duplicated on Habits — its own empty state already sits right
 * under a visible "+ New" button, which is low-friction enough on its own).
 */
export const HABIT_TEMPLATES = [
  { name: 'Drink water', category: 'Health' },
  { name: 'Read 10 minutes', category: 'Learning' },
  { name: 'Meditate', category: 'Mindfulness' },
  { name: 'Go for a walk', category: 'Fitness' },
  { name: 'Sleep by 11pm', category: 'Sleep' },
  { name: 'Tidy up', category: 'Home' },
];

export default function TemplateHabitsPicker({ onSelect, disabled = false }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);

  return (
    <View style={styles.grid}>
      {HABIT_TEMPLATES.map((template) => (
        <Pressable
          key={template.name}
          style={({ pressed }) => [styles.chip, pressed && !disabled ? styles.chipPressed : null]}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Add "${template.name}" as a habit`}
          onPress={() => onSelect(template)}
        >
          <MaterialCommunityIcons name={categoryIcon(template.category)} size={16} color={colors.accent} />
          <Text style={styles.chipText} numberOfLines={1}>
            {template.name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function makeStyles(colors, typography) {
  return StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      justifyContent: 'center',
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.accentSoft,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    chipPressed: { opacity: 0.7 },
    chipText: { ...typography.label, color: colors.accent },
  });
}
