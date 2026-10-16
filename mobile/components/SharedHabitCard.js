import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import StreakIndicator from './StreakIndicator';
import AvatarStack from './AvatarStack';
import { useAppTheme } from '../hooks/useAppTheme';
import { radii, shadow, spacing } from '../theme';

const RULE_LABEL = {
  all_members: 'All members',
  any_member: 'Any member',
};

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
  trackingMode = 'COOPERATIVE',
  myHabitId = null,
  checkedInToday = false,
  onToggleCheckIn,
  busy = false,
  onPress,
}) {
  const { colors, resolveStreakState } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const state = resolveStreakState(streakStatus);
  const people = Array.isArray(participants) ? participants : [];
  const total = participantCount != null ? participantCount : people.length;
  const Container = onPress ? Pressable : View;
  const isIndependent = trackingMode === 'INDEPENDENT';

  return (
    <Container
      style={onPress ? ({ pressed }) => [styles.card, pressed && styles.cardPressed] : styles.card}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `Manage ${name}` : undefined}
    >
      <View style={styles.topRow}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.topRowRight}>
          {!isIndependent ? <StreakIndicator streak={streak} status={streakStatus} compact /> : null}
          {onPress ? (
            <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} />
          ) : null}
        </View>
      </View>

      {isIndependent ? (
        <View style={styles.personalStreakRow}>
          {people.map((person, index) => {
            const label = typeof person === 'string' ? person : person && person.name;
            const personStreak = typeof person === 'object' && person ? person.currentStreak : null;
            return (
              <View key={`${label}-${index}`} style={styles.personalStreakChip}>
                <MaterialCommunityIcons name="fire" size={13} color={colors.accent} />
                <Text style={styles.personalStreakText} numberOfLines={1}>
                  {label} · {personStreak ?? 0}
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.middleRow}>
          <AvatarStack people={people} total={total} />

          <Text style={styles.participantCount}>
            {total} {total === 1 ? 'member' : 'members'}
          </Text>
        </View>
      )}

      <View style={styles.bottomRow}>
        <View style={styles.ruleBadge}>
          <MaterialCommunityIcons
            name={isIndependent ? 'account-multiple-outline' : 'shield-check-outline'}
            size={13}
            color={colors.textSecondary}
          />
          <Text style={styles.ruleText}>
            {isIndependent ? 'Independent streaks' : RULE_LABEL[rule] || RULE_LABEL.any_member}
          </Text>
        </View>

        {!isIndependent ? (
          <View style={[styles.statusBadge, { backgroundColor: state.background }]}>
            <MaterialCommunityIcons name={state.icon} size={13} color={state.color} />
            <Text style={[styles.statusText, { color: state.color }]}>{state.label}</Text>
          </View>
        ) : null}
      </View>

      {myHabitId && onToggleCheckIn ? (
        <Pressable
          style={[styles.logButton, checkedInToday && styles.logButtonActive]}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={checkedInToday ? 'Unlog today' : 'Check in today'}
          onPress={onToggleCheckIn}
        >
          <MaterialCommunityIcons
            name={checkedInToday ? 'check' : 'plus'}
            size={16}
            color={checkedInToday ? '#FFFFFF' : colors.accent}
          />
          <Text style={[styles.logButtonText, checkedInToday && styles.logButtonTextActive]}>
            {checkedInToday ? 'Checked in today' : 'Check in today'}
          </Text>
        </Pressable>
      ) : null}
    </Container>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow,
  },
  cardPressed: {
    opacity: 0.85,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  topRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
  participantCount: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  personalStreakRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  personalStreakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  personalStreakText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
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
    logButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: colors.accentSoft,
      borderRadius: radii.pill,
      paddingVertical: spacing.sm,
      marginTop: spacing.md,
    },
    logButtonActive: { backgroundColor: colors.accent },
    logButtonText: { fontSize: 13, fontWeight: '700', color: colors.accent },
    logButtonTextActive: { color: '#FFFFFF' },
  });
}
