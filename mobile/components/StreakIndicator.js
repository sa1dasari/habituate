import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { radii, resolveStreakState, spacing } from '../theme';

/**
 * The three designed states — safe / at_risk / frozen — each get their own
 * colour and icon. Note there is deliberately no "broken"/failure state:
 * a lapsed streak simply renders as a zero-day safe streak.
 */
export default function StreakIndicator({
  streak = 0,
  status = 'safe',
  showLabel = false,
  compact = false,
}) {
  const state = resolveStreakState(status);
  const iconSize = compact ? 12 : 14;

  return (
    <View
      style={[
        styles.container,
        compact && styles.containerCompact,
        { backgroundColor: state.background },
      ]}
      accessibilityLabel={`${streak} day streak, ${state.label}`}
    >
      <MaterialCommunityIcons name={state.icon} size={iconSize} color={state.color} />
      <Text style={[styles.text, compact && styles.textCompact, { color: state.color }]}>
        {streak}
        {compact ? 'd' : streak === 1 ? ' day' : ' days'}
      </Text>
      {showLabel ? (
        <Text style={[styles.label, { color: state.color }]}>· {state.label}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
    borderRadius: radii.pill,
    gap: spacing.xs,
  },
  containerCompact: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  text: {
    fontWeight: '800',
    fontSize: 13,
  },
  textCompact: {
    fontSize: 12,
  },
  label: {
    fontWeight: '600',
    fontSize: 12,
  },
});
