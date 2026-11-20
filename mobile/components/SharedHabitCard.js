import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AvatarStack from './AvatarStack';
import FlameIcon from './FlameIcon';
import MemberTowerRow from './MemberTowerRow';
import { useAppTheme } from '../hooks/useAppTheme';
import { fonts, radii, shadow, spacing } from '../theme';

// Board 08's own wording for the group-streak pill — distinct from the
// shared `streakStates` tokens (theme.js: "On track"/"Pending today"/
// "Freeze used") that every other streak badge in the app uses, so this
// stays a local map rather than renaming those shared labels and rippling
// into every other screen that reads them.
const BOARD_08_STATUS_LABEL = {
  safe: 'Safe today',
  at_risk: 'At risk today',
  frozen: 'Frozen',
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
  onPressPerson,
}) {
  const { colors, typography, resolveStreakState } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
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
        {!isIndependent ? (
          <View style={[styles.statusPill, { borderColor: state.color }]}>
            <Text style={[styles.statusPillText, { color: state.color }]}>
              {BOARD_08_STATUS_LABEL[streakStatus] || BOARD_08_STATUS_LABEL.safe}
            </Text>
          </View>
        ) : null}
      </View>

      {isIndependent ? (
        <View style={styles.personalStreakRow}>
          {people.map((person, index) => {
            const label = typeof person === 'string' ? person : person && person.name;
            const personStreak = typeof person === 'object' && person ? person.currentStreak : null;
            return (
              <View key={`${label}-${index}`} style={styles.personalStreakChip}>
                <FlameIcon width={13} height={13} streak={personStreak ?? 0} />
                <Text style={styles.personalStreakText} numberOfLines={1}>
                  {label} · {personStreak ?? 0}
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.towerRowWrap}>
          <MemberTowerRow members={people} towerWidth={66} height={130} />
        </View>
      )}

      <View style={styles.bottomRow}>
        {!isIndependent ? (
          <Text style={styles.groupRunText}>
            Group run: {streak} {streak === 1 ? 'day' : 'days'}
          </Text>
        ) : (
          <Text style={styles.groupRunText}>
            {total} {total === 1 ? 'member' : 'members'}
          </Text>
        )}
        <AvatarStack people={people} total={total} onPressPerson={onPressPerson} />
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

function makeStyles(colors, typography) {
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
  name: {
    ...typography.cardTitle,
    flexShrink: 1,
  },
  statusPill: {
    borderWidth: 1.5,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  statusPillText: { fontFamily: fonts.bold, fontSize: 12 },
  towerRowWrap: {
    marginTop: spacing.md,
    alignItems: 'center',
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
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.accent,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  groupRunText: { fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary },
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
    logButtonText: { fontFamily: fonts.bold, fontSize: 13, color: colors.accent },
    logButtonTextActive: { color: '#FFFFFF' },
  });
}
