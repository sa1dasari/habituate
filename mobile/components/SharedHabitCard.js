import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import StreakIndicator from './StreakIndicator';
import { colors, radii, resolveStreakState, shadow, spacing } from '../theme';

const RULE_LABEL = {
  all_members: 'All members',
  any_member: 'Any member',
};

const AVATAR_COLORS = ['#2563EB', '#7C3AED', '#0891B2', '#DB2777', '#EA580C'];
const MAX_AVATARS = 4;

function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

/**
 * Shared-habit card for the Community page. Shows who's in, the rule that keeps
 * the group streak alive, and the group streak's safe / at-risk / frozen state.
 */
export default function SharedHabitCard({
  name = 'Shared Habit',
  participants = [],
  participantCount,
  streak = 0,
  streakStatus = 'safe',
  rule = 'any_member',
}) {
  const state = resolveStreakState(streakStatus);
  const people = Array.isArray(participants) ? participants : [];
  const total = participantCount != null ? participantCount : people.length;
  const shown = people.slice(0, MAX_AVATARS);
  const overflow = total - shown.length;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <StreakIndicator streak={streak} status={streakStatus} compact />
      </View>

      <View style={styles.middleRow}>
        <View style={styles.avatars}>
          {shown.map((person, index) => {
            const label = typeof person === 'string' ? person : person && person.name;
            return (
              <View
                key={`${label}-${index}`}
                style={[
                  styles.avatar,
                  { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] },
                  index > 0 ? styles.avatarOverlap : null,
                ]}
              >
                <Text style={styles.avatarText}>{initials(label)}</Text>
              </View>
            );
          })}

          {overflow > 0 ? (
            <View style={[styles.avatar, styles.avatarMore, shown.length > 0 ? styles.avatarOverlap : null]}>
              <Text style={styles.avatarMoreText}>+{overflow}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.participantCount}>
          {total} {total === 1 ? 'member' : 'members'}
        </Text>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.ruleBadge}>
          <MaterialCommunityIcons name="shield-check-outline" size={13} color={colors.textSecondary} />
          <Text style={styles.ruleText}>{RULE_LABEL[rule] || RULE_LABEL.any_member}</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: state.background }]}>
          <MaterialCommunityIcons name={state.icon} size={13} color={state.color} />
          <Text style={[styles.statusText, { color: state.color }]}>{state.label}</Text>
        </View>
      </View>
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  middleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  avatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  avatarOverlap: {
    marginLeft: -8,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  avatarMore: {
    backgroundColor: colors.background,
  },
  avatarMoreText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  participantCount: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  ruleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  ruleText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
