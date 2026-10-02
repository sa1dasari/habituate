import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AvatarStack from './AvatarStack';
import { useAppTheme } from '../hooks/useAppTheme';
import { gradients, radii, shadow, spacing } from '../theme';

/**
 * Time-boxed challenge card — a progress bar, never a streak. No red/at-risk
 * state here by design: CLAUDE.md draws Challenges and Shared Habits as
 * deliberately separate mechanics, so this card never borrows streak colors.
 */
export default function ChallengeCard({
  name = 'Challenge',
  myProgress = 0,
  targetCount = 1,
  progressPercent = 0,
  participants = [],
  participantCount,
  joined = false,
  checkedInToday = false,
  onJoin,
  onToggleCheckIn,
  busy = false,
}) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.titleRow}>
          <View style={styles.iconBadge}>
            <MaterialCommunityIcons name="trophy-outline" size={18} color={colors.accent} />
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
        </View>
        {joined ? (
          <Text style={styles.progressLabel}>
            {myProgress}/{targetCount} days
          </Text>
        ) : null}
      </View>

      {joined ? (
        <>
          <View style={styles.progressTrack}>
            <LinearGradient
              colors={gradients.accent}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${Math.max(4, progressPercent)}%` }]}
            />
          </View>

          <View style={styles.bottomRow}>
            <Text style={styles.progressPercentLabel}>Progress</Text>
            <Text style={styles.progressPercent}>{progressPercent}%</Text>
          </View>
        </>
      ) : (
        <Text style={styles.notJoinedNote}>Not joined yet</Text>
      )}

      <View style={styles.footerRow}>
        <AvatarStack people={participants} total={participantCount} size={24} />

        {joined ? (
          <Pressable
            style={[styles.logButton, checkedInToday && styles.logButtonActive]}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={checkedInToday ? `Unlog today for ${name}` : `Log today for ${name}`}
            onPress={onToggleCheckIn}
          >
            <MaterialCommunityIcons
              name={checkedInToday ? 'check' : 'plus'}
              size={16}
              color={checkedInToday ? '#FFFFFF' : colors.accent}
            />
            <Text style={[styles.logButtonText, checkedInToday && styles.logButtonTextActive]}>
              {checkedInToday ? 'Logged today' : 'Log today'}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.joinButton}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Join ${name}`}
            onPress={onJoin}
          >
            <Text style={styles.joinButtonText}>Join</Text>
          </Pressable>
        )}
      </View>
    </View>
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
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flexShrink: 1,
    },
    iconBadge: {
      width: 32,
      height: 32,
      borderRadius: radii.md,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: { ...typography.cardTitle, flexShrink: 1 },
    progressLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.accent,
    },
    progressTrack: {
      height: 8,
      borderRadius: radii.pill,
      backgroundColor: colors.ringTrack,
      overflow: 'hidden',
      marginTop: spacing.md,
    },
    progressFill: {
      height: '100%',
      borderRadius: radii.pill,
    },
    bottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
    },
    progressPercentLabel: { ...typography.meta },
    progressPercent: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    notJoinedNote: {
      ...typography.meta,
      marginTop: spacing.sm,
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.md,
    },
    logButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.accentSoft,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs,
    },
    logButtonText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.accent,
    },
    logButtonActive: {
      backgroundColor: colors.accent,
    },
    logButtonTextActive: {
      color: '#FFFFFF',
    },
    joinButton: {
      backgroundColor: colors.accent,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xs + 2,
    },
    joinButtonText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
}
