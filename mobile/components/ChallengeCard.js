import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AvatarStack from './AvatarStack';
import LandmarkTowerGraphic from './LandmarkTowerGraphic';
import { useAppTheme } from '../hooks/useAppTheme';
import { useHoldGesture } from '../hooks/useHoldGesture';
import { useTapToBuild } from '../hooks/useTapToBuild';
import { fonts, radii, shadow, skylineTowerTheme, spacing } from '../theme';
import { daysUntil } from '../utils/date';

const MEMBER_COLORS = ['#2563EB', '#7C3AED', '#0891B2', '#DB2777', '#EA580C'];

function totalBuilt(participants) {
  return (Array.isArray(participants) ? participants : []).reduce((sum, p) => sum + Math.max(0, p?.progress || 0), 0);
}

/**
 * Board 09: a Challenge card is a landmark silhouette, not a progress bar —
 * "N of M floors built" plus "Your part: N", matching the detail page
 * (board 11) rather than the old flat percentage bar. No red/at-risk state
 * here by design: CLAUDE.md draws Challenges and Shared Habits as
 * deliberately separate mechanics.
 */
export default function ChallengeCard({
  name = 'Challenge',
  trackingMode = 'BOOLEAN',
  myProgress = 0,
  targetCount = 1,
  participants = [],
  participantCount,
  joined = false,
  checkedInToday = false,
  periodEnd = null,
  onJoin,
  onToggleCheckIn,
  onPress,
  onPressPerson,
  busy = false,
}) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { tapToBuild } = useTapToBuild();
  const Container = onPress ? Pressable : View;
  const isCount = trackingMode === 'COUNT';
  const built = totalBuilt(participants);
  const hasEnded = !!periodEnd && daysUntil(periodEnd) < 0;
  const { gesture, progress, lift } = useHoldGesture({
    canBuild: joined && !isCount && !checkedInToday && !hasEnded && !busy,
    tapToBuild,
    onBuild: onToggleCheckIn,
  });
  const animatedLift = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));
  const animatedFill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  const contributors = (Array.isArray(participants) ? participants : []).map((p, i) => ({
    color: MEMBER_COLORS[i % MEMBER_COLORS.length],
    floors: Math.max(0, p?.progress || 0),
  }));

  return (
    <Container
      style={onPress ? ({ pressed }) => [styles.card, pressed && styles.cardPressed] : styles.card}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `View ${name}` : undefined}
    >
      <View style={styles.body}>
        {joined ? (
          <LandmarkTowerGraphic
            contributors={contributors}
            towerTheme={skylineTowerTheme.dark}
            width={70}
            height={140}
            testID={`challenge-landmark-${name}`}
          />
        ) : (
          <View style={styles.unjoinedTowerPlaceholder}>
            <MaterialCommunityIcons name="office-building-outline" size={26} color={colors.textMuted} />
          </View>
        )}

        <View style={styles.infoCol}>
          <View style={styles.titleRow}>
            <Text style={styles.name} numberOfLines={2}>
              {name}
            </Text>
            <View style={styles.socialBadge} accessibilityElementsHidden importantForAccessibility="no">
              <MaterialCommunityIcons name="account-multiple" size={11} color={colors.accent} />
            </View>
          </View>

          {joined ? (
            <>
              <Text style={styles.builtText} numberOfLines={1}>
                {built} of {targetCount} floors built
              </Text>
              <Text style={styles.yourPartText} numberOfLines={1}>
                Your part: {myProgress}
                {isCount ? '' : ' days'}
              </Text>
            </>
          ) : (
            <Text style={styles.notJoinedNote}>Not joined yet</Text>
          )}
        </View>
      </View>

      <View style={styles.footerRow}>
        <AvatarStack people={participants} total={participantCount} size={24} onPressPerson={onPressPerson} />

        {joined ? (
          isCount ? (
            <Pressable
              style={styles.logButton}
              disabled={busy || hasEnded}
              accessibilityRole="button"
              accessibilityLabel={hasEnded ? `${name} has ended` : `Add an entry for ${name}`}
              onPress={onToggleCheckIn}
            >
              <MaterialCommunityIcons name="plus" size={16} color={colors.accent} />
              <Text style={styles.logButtonText}>{hasEnded ? 'Ended' : 'Log entry'}</Text>
            </Pressable>
          ) : checkedInToday ? (
            <View style={[styles.logButton, styles.logButtonActive]}>
              <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
              <Text style={[styles.logButtonText, styles.logButtonTextActive]}>Logged today</Text>
            </View>
          ) : (
            <GestureDetector gesture={gesture}>
              <Animated.View
                testID={`challenge-card-hold-${name}`}
                accessibilityRole="button"
                accessibilityLabel={hasEnded ? `${name} has ended` : `Hold to log today for ${name}`}
                style={[styles.logButton, hasEnded && styles.logButtonDisabled, animatedLift]}
              >
                <Animated.View style={[styles.logButtonFill, animatedFill]} />
                <MaterialCommunityIcons name="plus" size={16} color={colors.accent} />
                <Text style={styles.logButtonText}>{hasEnded ? 'Ended' : 'Hold to log'}</Text>
              </Animated.View>
            </GestureDetector>
          )
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
    body: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    unjoinedTowerPlaceholder: {
      width: 70,
      height: 140,
      borderRadius: radii.md,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoCol: { flex: 1, justifyContent: 'flex-end', paddingBottom: spacing.sm },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flexShrink: 1,
      marginBottom: spacing.sm,
    },
    name: { ...typography.cardTitle, flexShrink: 1 },
    // A small "this involves other people" marker shared with SharedHabitCard
    // — the one consistent visual cue that tells a social card apart from a
    // solo HabitCard by silhouette alone, not just by its copy.
    socialBadge: {
      width: 18,
      height: 18,
      borderRadius: radii.pill,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    builtText: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary },
    yourPartText: { ...typography.meta, marginTop: spacing.xs },
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
      overflow: 'hidden',
    },
    logButtonFill: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      backgroundColor: colors.accent,
      opacity: 0.35,
    },
    logButtonDisabled: {
      opacity: 0.5,
    },
    logButtonText: {
      fontFamily: fonts.bold,
      fontSize: 12,
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
      fontFamily: fonts.bold,
      fontSize: 12,
      color: '#FFFFFF',
    },
  });
}
