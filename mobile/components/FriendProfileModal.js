import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AvatarImage from './AvatarImage';
import FlameIcon from './FlameIcon';
import FriendTowerGraphic from './FriendTowerGraphic';
import SkyBackdrop from './SkyBackdrop';
import SharedHabitDetailModal from './SharedHabitDetailModal';
import StreakIndicator from './StreakIndicator';
import { useAppTheme } from '../hooks/useAppTheme';
import { useGroups } from '../hooks/useGroups';
import { useHabits } from '../hooks/useHabits';
import { towerCapInfo } from '../utils/towerAge';
import api from '../api/client';
import { gradients, radii, shadow, shadowLg, skyGradients, skylineTowerTheme, spacing } from '../theme';

const SKY_STRIP_HEIGHT = 190;
const TOWER_GRAPHIC_WIDTH = 70;

/**
 * The tappable friend-profile viewer — opened by tapping a friend's name/avatar anywhere it
 * appears (Shared Habit member rows, Challenge participant rows, the compact avatar stacks on
 * Community cards). Fetches GET /api/users/{userId}/profile fresh every time it opens rather
 * than being handed pre-fetched data, since the same userId can be reached from several
 * different screens that don't all already have fuller profile info loaded.
 *
 * PRIVATE visibility (the default for every account) shows only name/username/avatar plus any
 * Shared Habit group streak the viewer and this friend are both currently active members of
 * together. PUBLIC additionally shows aggregate stats — never a per-habit breakdown, matching
 * the API's own restraint.
 */
export default function FriendProfileModal({ visible, userId, onClose }) {
  const { colors, typography } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, typography), [colors, typography]);

  const { groups } = useGroups();
  const { habits } = useHabits();
  // Always the dark-mode night sky and dark-mode tower palette, regardless
  // of the app's own light/dark setting — not just so a pair of towers
  // reads consistently next to each other, but because constants/towerColors.js's
  // "light" tower hexes are deliberately darkened to read against a light background
  // (skylineUI.light.background); on this strip's always-dark sky they'd
  // invert into dark towers on a dark sky. The strip is a fixed self-
  // contained night scene either way, same reasoning SkyBackdrop already
  // uses to hardcode its own stars as plain white.
  const towerTheme = skylineTowerTheme.dark;
  const skyStops = skyGradients.dark.night;
  const [stripWidth, setStripWidth] = useState(0);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  useEffect(() => {
    if (!visible || !userId) {
      setProfile(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getFriendProfile(userId)
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Something went wrong');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, userId]);

  const isPublic = profile?.visibility === 'PUBLIC';
  const sharedStreaks = profile?.sharedGroupStreaks || [];
  // FriendProfileModal's own summary only carries groupId/name/streak — the
  // full participant/check-in detail SharedHabitDetailModal needs lives in
  // the already-loaded groups list (this friend's shared group is one we're
  // also a member of, so it's guaranteed to be in our own `groups`).
  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || null;

  // Board 44's "You" vs the friend pair (no connecting line, owner decision
  // 2026-11-20 — "no skybridges anywhere"): the first mutual Shared Habit
  // that carries a theirTower (STATUS_ONLY groups omit it server-side — see
  // FriendProfileService). "My" side isn't in this API response at all (it's
  // the viewer's own account, not the target's) — resolved from the
  // viewer's own already-loaded habit for that same group
  // (`group.myHabitId`). floorCount uses the same calendar-days-stood rule
  // the server uses for theirTower (utils/towerAge.js's towerCapInfo,
  // +1 for its 0-based daysStood vs the server's 1-based "day one is one
  // floor") — currentRun must stay its own number, not floorCount, or every
  // window renders lit regardless of how long the run actually is.
  const skybridgeStreak = !isPublic ? sharedStreaks.find((g) => g.theirTower) : null;
  const myGroup = skybridgeStreak ? groups.find((g) => g.id === skybridgeStreak.groupId) : null;
  const myHabit = myGroup?.myHabitId ? habits.find((h) => h.id === myGroup.myHabitId) : null;
  const myTower = myHabit
    ? {
        color: myHabit.color || 'slate',
        floorCount: towerCapInfo(myHabit).daysStood + 1,
        currentRun: myHabit.streak || 0,
        closedSegmentFloorCounts: [],
      }
    : null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Profile
          </Text>
          <View style={{ width: 34 }} />
        </View>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : error ? (
          <View style={styles.loaderWrap}>
            <MaterialCommunityIcons name="alert-circle-outline" size={28} color={colors.textMuted} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : profile ? (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.heroCard}>
              <View style={styles.avatarLg}>
                <AvatarImage uri={profile.photoUrl} name={profile.displayName} size={64} fontSize={22} />
              </View>
              <Text style={styles.heroName}>{profile.displayName || 'Habituate user'}</Text>
              {profile.username ? <Text style={styles.heroUsername}>@{profile.username}</Text> : null}

              <View style={[styles.visibilityBadge, isPublic ? styles.visibilityBadgePublic : null]}>
                <MaterialCommunityIcons
                  name={isPublic ? 'earth' : 'lock-outline'}
                  size={13}
                  color={isPublic ? colors.safe : colors.textSecondary}
                />
                <Text style={[styles.visibilityText, { color: isPublic ? colors.safe : colors.textSecondary }]}>
                  {isPublic ? 'Public profile' : 'Private profile'}
                </Text>
              </View>
            </View>

            {isPublic && profile.towers && profile.towers.length > 0 ? (
              <View style={styles.skyStrip} onLayout={(e) => setStripWidth(e.nativeEvent.layout.width)}>
                <View style={StyleSheet.absoluteFill}>
                  {stripWidth > 0 ? (
                    <SkyBackdrop stops={skyStops} kind="night" width={stripWidth} height={SKY_STRIP_HEIGHT} />
                  ) : null}
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.towerRow}
                  testID="friend-skyline-tower-row"
                >
                  {profile.towers.map((tower, i) => (
                    <FriendTowerGraphic
                      key={i}
                      tower={tower}
                      mode="dark"
                      towerTheme={towerTheme}
                      width={TOWER_GRAPHIC_WIDTH}
                      height={SKY_STRIP_HEIGHT}
                      testID={`friend-skyline-tower-${i}`}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {!isPublic && myTower && skybridgeStreak ? (
              <View>
                <View style={styles.skyStrip} onLayout={(e) => setStripWidth(e.nativeEvent.layout.width)}>
                  <View style={StyleSheet.absoluteFill}>
                    {stripWidth > 0 ? (
                      <SkyBackdrop stops={skyStops} kind="night" width={stripWidth} height={SKY_STRIP_HEIGHT} />
                    ) : null}
                  </View>
                  <View style={styles.towerPairRow}>
                    <FriendTowerGraphic
                      tower={myTower}
                      mode="dark"
                      towerTheme={towerTheme}
                      width={TOWER_GRAPHIC_WIDTH}
                      height={SKY_STRIP_HEIGHT}
                      testID="friend-tower-pair-you"
                    />
                    <FriendTowerGraphic
                      tower={skybridgeStreak.theirTower}
                      mode="dark"
                      towerTheme={towerTheme}
                      width={TOWER_GRAPHIC_WIDTH}
                      height={SKY_STRIP_HEIGHT}
                      testID="friend-tower-pair-them"
                    />
                  </View>
                </View>
                <View style={styles.towerPairLabels}>
                  <Text style={styles.towerPairLabel}>You</Text>
                  <Text style={styles.towerPairLabel} numberOfLines={1}>
                    {profile.displayName || 'Friend'}
                  </Text>
                </View>
              </View>
            ) : null}

            {isPublic && profile.publicStats ? (
              <View style={styles.statsCard}>
                <Text style={styles.sectionTitle}>Overview</Text>
                <View style={styles.statsGrid}>
                  <StatTile
                    styles={styles}
                    icon={<FlameIcon width={20} height={20} streak={profile.publicStats.bestCurrentStreak} />}
                    label="Best current streak"
                    value={`${profile.publicStats.bestCurrentStreak}d`}
                  />
                  <StatTile
                    styles={styles}
                    icon={<MaterialCommunityIcons name="trophy-outline" size={20} color={colors.accent} />}
                    label="Longest streak"
                    value={`${profile.publicStats.bestLongestStreak}d`}
                  />
                  <StatTile
                    styles={styles}
                    icon={<MaterialCommunityIcons name="target" size={20} color={colors.accent} />}
                    label="Active habits"
                    value={String(profile.publicStats.activeHabitCount)}
                  />
                  <StatTile
                    styles={styles}
                    icon={<MaterialCommunityIcons name="calendar-check-outline" size={20} color={colors.accent} />}
                    label="Member since"
                    value={profile.publicStats.memberSince || '—'}
                  />
                </View>

                <Text style={styles.consistencyLabel}>
                  {profile.publicStats.consistencyPercent30d}% consistency · last 30 days (all habits)
                </Text>
                <View style={styles.progressTrack}>
                  <LinearGradient
                    colors={gradients.accent}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.progressFill,
                      { width: `${Math.max(4, Math.min(100, profile.publicStats.consistencyPercent30d))}%` },
                    ]}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.privateNote}>
                <MaterialCommunityIcons name="shield-lock-outline" size={18} color={colors.textMuted} />
                <Text style={styles.privateNoteText}>
                  {profile.displayName || 'This person'} keeps their stats private. You can still see any Shared
                  Habit streak you're both part of below.
                </Text>
              </View>
            )}

            <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>
              Shared with you {sharedStreaks.length > 0 ? `(${sharedStreaks.length})` : ''}
            </Text>
            {sharedStreaks.length === 0 ? (
              <Text style={styles.emptyNote}>No Shared Habits in common yet.</Text>
            ) : (
              sharedStreaks.map((group) => {
                // This summary only ever carries id/name/streak — opening the
                // real detail needs the full group object from our own
                // already-loaded groups list (see selectedGroup above). If
                // it's not there (stale cache, not yet loaded), don't offer
                // a tap that would silently do nothing.
                const resolvable = groups.some((g) => g.id === group.groupId);
                return (
                  <Pressable
                    key={group.groupId}
                    style={styles.groupRow}
                    disabled={!resolvable}
                    onPress={() => setSelectedGroupId(group.groupId)}
                    accessibilityRole={resolvable ? 'button' : undefined}
                    accessibilityLabel={resolvable ? `View ${group.groupName} shared habit` : undefined}
                  >
                    <View style={styles.groupIcon}>
                      <MaterialCommunityIcons name="account-multiple-outline" size={16} color={colors.accent} />
                    </View>
                    <Text style={styles.groupName} numberOfLines={1}>
                      {group.groupName}
                    </Text>
                    <StreakIndicator streak={group.currentStreak} status={group.status} compact />
                    {resolvable ? (
                      <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} />
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        ) : null}
      </SafeAreaView>
      <SharedHabitDetailModal
        visible={!!selectedGroup}
        group={selectedGroup}
        onClose={() => setSelectedGroupId(null)}
      />
    </Modal>
  );
}

function StatTile({ icon, label, value, styles }) {
  return (
    <View style={styles.statTile}>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function makeStyles(colors, typography) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { ...typography.sectionTitle, flex: 1, textAlign: 'center' },
    closeBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
    loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
    errorText: { ...typography.meta, textAlign: 'center' },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
    heroCard: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.xl,
      marginBottom: spacing.lg,
      ...shadowLg,
    },
    avatarLg: {
      width: 64,
      height: 64,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accentSoft,
      overflow: 'hidden',
      marginBottom: spacing.sm,
    },
    heroName: { ...typography.cardTitle, fontSize: 18, textAlign: 'center' },
    heroUsername: { ...typography.meta, marginTop: 2 },
    visibilityBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.background,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs,
      marginTop: spacing.md,
    },
    visibilityBadgePublic: { backgroundColor: colors.safeSoft },
    visibilityText: { fontSize: 12, fontWeight: '700' },
    skyStrip: {
      height: SKY_STRIP_HEIGHT,
      borderRadius: radii.lg,
      overflow: 'hidden',
      marginBottom: spacing.sm,
      ...shadow,
    },
    towerRow: {
      flexGrow: 1,
      alignItems: 'flex-end',
      paddingHorizontal: spacing.sm,
      minWidth: '100%',
      justifyContent: 'space-around',
    },
    // No connecting line between the two towers (owner decision 2026-11-20,
    // "no skybridges anywhere") — just the pair, spaced apart.
    towerPairRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: spacing.xxl,
    },
    towerPairLabels: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: TOWER_GRAPHIC_WIDTH + spacing.xxl,
      marginBottom: spacing.lg,
    },
    towerPairLabel: { ...typography.meta, fontWeight: '700', color: colors.textPrimary },
    statsCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      ...shadow,
    },
    sectionTitle: { ...typography.sectionTitle, marginBottom: spacing.md },
    sectionTitleSpaced: { marginTop: spacing.xs },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
    statTile: {
      width: '47%',
      backgroundColor: colors.background,
      borderRadius: radii.md,
      padding: spacing.md,
      gap: 4,
    },
    statValue: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
    statLabel: { ...typography.meta },
    consistencyLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
    progressTrack: {
      height: 8,
      borderRadius: radii.pill,
      backgroundColor: colors.ringTrack,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: radii.pill },
    privateNote: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      ...shadow,
    },
    privateNoteText: { ...typography.body, flex: 1 },
    emptyNote: { ...typography.meta },
    groupRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    groupIcon: {
      width: 32,
      height: 32,
      borderRadius: radii.md,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    groupName: { flex: 1, fontSize: 14, color: colors.textPrimary },
  });
}
