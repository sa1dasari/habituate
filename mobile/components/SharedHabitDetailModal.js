import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import FlameIcon from './FlameIcon';
import InviteFriendsSheet from './InviteFriendsSheet';
import CreateGroupModal from './CreateGroupModal';
import AvatarImage from './AvatarImage';
import FriendProfileModal from './FriendProfileModal';
import MemberTowerRow from './MemberTowerRow';
import SkyBackdrop from './SkyBackdrop';
import HoldToBuildBar from './HoldToBuildBar';
import Toast from './Toast';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAuth } from '../hooks/useAuth';
import { useGroups } from '../hooks/useGroups';
import { useHabits } from '../hooks/useHabits';
import { useToast } from '../hooks/useToast';
import { radii, shadow, skyGradients, spacing } from '../theme';

const SKY_STRIP_HEIGHT = 230;

const RULE_LABEL = {
  all_members: 'All members',
  any_member: 'Any member',
};

const AVATAR_COLORS = ['#2563EB', '#7C3AED', '#0891B2', '#DB2777', '#EA580C'];

// Same board-08 wording SharedHabitCard.js uses for the list card's pill —
// kept as a local copy there for the same reason (distinct from the shared
// `streakStates` tokens every other streak badge in the app reads). This is
// the detail screen's only At-risk/Frozen signal now that the skybridge
// legend is gone (owner decision 2026-11-20, "no skybridges anywhere").
const BOARD_08_STATUS_LABEL = {
  safe: 'Safe today',
  at_risk: 'At risk today',
  frozen: 'Frozen',
};

function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

/** Detail view for one Shared Habit, opened by tapping its card — not the create/manage flow. */
export default function SharedHabitDetailModal({ visible, group, onClose }) {
  const { colors, resolveStreakState, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { user } = useAuth();
  const { inviteToGroup, nudge, busy, refresh: refreshGroups } = useGroups();
  const { toggleCheckIn, busy: habitsBusy } = useHabits();
  const [inviteVisible, setInviteVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [profileUserId, setProfileUserId] = useState(null);
  const [stripWidth, setStripWidth] = useState(0);
  const { toast, showToast, hideToast } = useToast();

  if (!group) return null;

  const state = resolveStreakState(group.streakStatus);
  const isIndependent = group.trackingMode === 'INDEPENDENT';
  // Most-checked-in-first, but ONLY in Independent mode, where each
  // person's own streak is the thing actually rendered next to their name
  // (memberStreakRow below) — the ordering has a visible reason. In
  // all_members/any_member mode nobody's streak shows at all (it's one
  // shared streak for the whole group), so sorting by it would quietly
  // reorder the list by a number nobody can see: just "your friend is
  // above you" with no visible cause, in a feature this app frames as
  // cooperative ("one streak, two people"), not a leaderboard. Stable
  // array order there instead.
  const people = Array.isArray(group.participants)
    ? isIndependent
      ? group.participants.slice().sort((a, b) => {
          const streakA = typeof a === 'object' && a ? a.currentStreak ?? -1 : -1;
          const streakB = typeof b === 'object' && b ? b.currentStreak ?? -1 : -1;
          return streakB - streakA;
        })
      : group.participants
    : [];
  const myParticipant = people.find((p) => typeof p === 'object' && p && user && p.userId === user.uid);
  const myCheckedInToday = myParticipant ? myParticipant.checkedInToday : false;

  // Avatar color assigned from each person's position in the ORIGINAL
  // (unsorted) participant order, not the post-sort render index — keeps
  // everyone's color stable instead of reshuffling whenever Independent-mode
  // streak order changes their rank.
  const colorKeyOf = (person, idx) => (typeof person === 'object' && person && person.userId) || `idx-${idx}`;
  const colorByKey = new Map(
    (Array.isArray(group.participants) ? group.participants : []).map((p, i) => [
      colorKeyOf(p, i),
      AVATAR_COLORS[i % AVATAR_COLORS.length],
    ])
  );

  // InviteFriendsSheet owns the success/failure feedback (including the
  // real backend reason, e.g. "already invited") — this just passes the
  // call through rather than swallowing it to a boolean.
  const handleInvite = (friendUserId) => inviteToGroup(group.id, friendUserId);

  // toggleCheckIn only refreshes useHabits' own list — this modal's `group` prop comes from
  // useGroups' separate list, which never hears about it otherwise. Without this refresh the
  // button looked completely unresponsive: the check-in landed, but checkedInToday here never
  // flipped, because group never got refetched.
  const handleToggleMyCheckIn = async () => {
    if (!group.myHabitId) return;
    try {
      await toggleCheckIn(group.myHabitId);
      await refreshGroups();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update check-in', 'error');
    }
  };

  const handleNudge = async (targetUserId, label) => {
    try {
      await nudge(group.id, targetUserId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast(`Nudge sent — ${label} will get a reminder.`, 'success');
    } catch (err) {
      showToast(err?.message || "Couldn't send nudge — try again.", 'error');
    }
  };

  // Board 10's "Today: 3 of 4 laid. Waiting on Dev." and its "Cheer Dev"
  // button. Real check_in_cheers (api/client.js's cheerCheckIn) cheers one
  // specific check-in and this screen has no check-in id for a groupmate's
  // day, so this reuses the existing nudge mechanic instead — and is
  // labeled "Nudge", not "Cheer", so the label matches what actually
  // happens (a reminder push to the named person, per handleNudge's own
  // toast) rather than promising encouragement it doesn't send. The
  // activity feed's own Cheer button (DismissibleActivityRow) is the real
  // thing, scoped to a specific check-in.
  const waitingOn = (Array.isArray(group.participants) ? group.participants : [])
    .filter((p) => typeof p === 'object' && p && !p.checkedInToday)
    .filter((p) => !(user && p.userId === user.uid));
  const checkedInCount = (Array.isArray(group.participants) ? group.participants : []).filter(
    (p) => typeof p === 'object' && p && p.checkedInToday
  ).length;
  const totalParticipantCount = group.participantCount != null ? group.participantCount : people.length;
  const todayText =
    waitingOn.length === 0
      ? `${checkedInCount} of ${totalParticipantCount} laid. Everyone's in today!`
      : `${checkedInCount} of ${totalParticipantCount} laid. Waiting on ${waitingOn.map((p) => p.name).join(', ')}.`;
  const cheerTarget = waitingOn[0] || null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {/* RN's Modal renders in its own native surface, separate from the app's root
          view — the GestureHandlerRootView wrapping App.js doesn't extend into it, so
          HoldToBuildBar's GestureDetector had nowhere to attach its native handlers
          and silently did nothing. See NotificationCenterModal.js for the same fix. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
          <View style={styles.headerTitleCol}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {group.name}
              </Text>
              {!isIndependent ? (
                <View style={[styles.statusPill, { borderColor: state.color }]}>
                  <Text style={[styles.statusPillText, { color: state.color }]}>
                    {BOARD_08_STATUS_LABEL[group.streakStatus] || BOARD_08_STATUS_LABEL.safe}
                  </Text>
                </View>
              ) : null}
            </View>
            {!isIndependent ? (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                Shared habit · {RULE_LABEL[group.rule] || RULE_LABEL.any_member} · Cooperative streak
              </Text>
            ) : (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                Shared habit · Independent streaks
              </Text>
            )}
          </View>
          {group.canEdit ? (
            <Pressable onPress={() => setEditVisible(true)} hitSlop={12} style={styles.closeBtn}>
              <MaterialCommunityIcons name="pencil-outline" size={20} color={colors.accent} />
            </Pressable>
          ) : (
            <View style={{ width: 34 }} />
          )}
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {!isIndependent ? (
            <>
              <View style={styles.skyStrip} onLayout={(e) => setStripWidth(e.nativeEvent.layout.width)}>
                <View style={StyleSheet.absoluteFill}>
                  {stripWidth > 0 ? (
                    <SkyBackdrop stops={skyGradients.dark.night} kind="night" width={stripWidth} height={SKY_STRIP_HEIGHT} />
                  ) : null}
                </View>
                <MemberTowerRow
                  members={people}
                  showLabels
                  isSelf={(p) => !!(user && p?.userId === user.uid)}
                  towerWidth={70}
                  height={SKY_STRIP_HEIGHT}
                />
              </View>

              <View style={styles.tileRow}>
                <View style={styles.tile}>
                  <Text style={styles.tileLabel}>Group run</Text>
                  <Text style={[styles.tileValue, { color: state.color }]}>
                    {group.streak} {group.streak === 1 ? 'day' : 'days'}
                  </Text>
                </View>
                <View style={styles.tile}>
                  <Text style={styles.tileLabel}>Today</Text>
                  <Text style={styles.tileBody}>{todayText}</Text>
                </View>
              </View>

              <Text style={styles.metaLine}>
                {group.longestStreak != null ? `Longest streak: ${group.longestStreak}d · ` : ''}
                {group.skipDaysPerMonth} skip day{group.skipDaysPerMonth === 1 ? '' : 's'} allowed a month ·{' '}
                {group.visibilityLevel === 'STATUS_ONLY' ? 'Status only' : 'Full details'} visible to groupmates
              </Text>

              {group.myHabitId ? (
                <View style={styles.actionRow}>
                  <View style={{ flex: 1 }}>
                    <HoldToBuildBar
                      built={myCheckedInToday}
                      canBuild={!!group.myHabitId && !myCheckedInToday}
                      onBuild={handleToggleMyCheckIn}
                      label="Hold to build"
                      builtLabel="Built today"
                      testID="shared-habit-hold-to-build"
                    />
                  </View>
                  {cheerTarget && group.nudgesEnabled ? (
                    <Pressable
                      style={styles.cheerBtn}
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityLabel={`Nudge ${cheerTarget.name}`}
                      onPress={() => handleNudge(cheerTarget.userId, cheerTarget.name)}
                    >
                      <Text style={styles.cheerBtnText}>Nudge {cheerTarget.name}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </>
          ) : (
          <View style={styles.heroCard}>
            <View style={styles.heroRow}>
              <View style={styles.ruleBadge}>
                <MaterialCommunityIcons name="account-multiple-outline" size={13} color={colors.textSecondary} />
                <Text style={styles.ruleText}>Independent streaks</Text>
              </View>
              <View style={styles.ruleBadge}>
                <MaterialCommunityIcons name="target" size={13} color={colors.textSecondary} />
                <Text style={styles.ruleText}>{group.goalAlignment === 'SPLIT' ? 'Split goal' : 'Unified goal'}</Text>
              </View>
            </View>
            <Text style={styles.longestStreak}>
              {group.visibilityLevel === 'STATUS_ONLY' ? 'Status only — amounts hidden from groupmates' : 'Full details visible to groupmates'}
            </Text>

            {group.myHabitId ? (
              <Pressable
                style={[styles.logButton, myCheckedInToday && styles.logButtonActive]}
                disabled={habitsBusy}
                accessibilityRole="button"
                accessibilityLabel={myCheckedInToday ? 'Unlog today' : 'Log today'}
                onPress={handleToggleMyCheckIn}
              >
                <MaterialCommunityIcons
                  name={myCheckedInToday ? 'check' : 'plus'}
                  size={16}
                  color={myCheckedInToday ? '#FFFFFF' : colors.accent}
                />
                <Text style={[styles.logButtonText, myCheckedInToday && styles.logButtonTextActive]}>
                  {myCheckedInToday ? 'Checked in today' : 'Check in today'}
                </Text>
              </Pressable>
            ) : null}
          </View>
          )}

          <Text style={styles.sectionTitle}>
            {people.length} {people.length === 1 ? 'member' : 'members'}
          </Text>
          {people.map((person, index) => {
            const label = typeof person === 'string' ? person : person && person.name;
            const personUserId = typeof person === 'object' && person ? person.userId : null;
            const personStreak = typeof person === 'object' && person ? person.currentStreak : null;
            const personCheckedInToday = typeof person === 'object' && person ? person.checkedInToday : false;
            const personPhotoUrl = typeof person === 'object' && person ? person.photoUrl : null;
            const isSelf = personUserId && user && personUserId === user.uid;
            return (
              <View key={personUserId || `${label}-${index}`} style={styles.memberRow}>
                <Pressable
                  style={styles.memberTapTarget}
                  disabled={!personUserId || isSelf}
                  onPress={() => setProfileUserId(personUserId)}
                  accessibilityRole={!isSelf && personUserId ? 'button' : undefined}
                  accessibilityLabel={!isSelf && personUserId ? `View ${label}'s profile` : undefined}
                >
                  <View
                    style={[
                      styles.avatar,
                      personPhotoUrl
                        ? styles.avatarPhoto
                        : { backgroundColor: colorByKey.get(colorKeyOf(person, index)) || AVATAR_COLORS[index % AVATAR_COLORS.length] },
                    ]}
                  >
                    {personPhotoUrl ? (
                      <AvatarImage uri={personPhotoUrl} name={label} size={32} fontSize={13} />
                    ) : (
                      <Text style={styles.avatarText}>{initials(label)}</Text>
                    )}
                  </View>
                  <Text style={styles.memberName}>
                    {label}
                    {isSelf ? ' (you)' : ''}
                  </Text>
                </Pressable>
                {isIndependent ? (
                  <View style={styles.memberStreakRow}>
                    <FlameIcon width={16} height={16} streak={personStreak ?? 0} />
                    <Text style={styles.memberStreak}>{personStreak ?? 0}</Text>
                  </View>
                ) : null}
                {personCheckedInToday ? (
                  <MaterialCommunityIcons name="check-circle" size={16} color={colors.safe} style={{ marginRight: spacing.xs }} />
                ) : null}
                {group.nudgesEnabled && !isSelf && personUserId ? (
                  <Pressable
                    style={styles.nudgeBtn}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={`Nudge ${label}`}
                    onPress={() => handleNudge(personUserId, label)}
                  >
                    <MaterialCommunityIcons name="hand-wave-outline" size={16} color={colors.accent} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}

          <View style={styles.inviteSection}>
            <Pressable style={styles.secondaryButton} onPress={() => setInviteVisible(true)}>
              <MaterialCommunityIcons name="account-plus-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.secondaryButtonText}>Invite a friend</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
      </GestureHandlerRootView>

      <InviteFriendsSheet
        visible={inviteVisible}
        onClose={() => setInviteVisible(false)}
        onInvite={handleInvite}
        busy={busy}
        title={`Invite to ${group.name}`}
      />
      <CreateGroupModal
        visible={editVisible}
        group={group}
        onClose={() => setEditVisible(false)}
        onDeleted={() => {
          setEditVisible(false);
          onClose();
        }}
      />
      <FriendProfileModal visible={!!profileUserId} userId={profileUserId} onClose={() => setProfileUserId(null)} />
      <Toast toast={toast} onHide={hideToast} />
    </Modal>
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
    headerTitleCol: { flex: 1, alignItems: 'center' },
    headerTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
    headerTitle: { ...typography.sectionTitle, textAlign: 'center', flexShrink: 1 },
    headerSubtitle: { ...typography.meta, marginTop: 2, textAlign: 'center' },
    statusPill: {
      borderWidth: 1.5,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    statusPillText: { fontSize: 11, fontWeight: '700' },
    closeBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
    skyStrip: {
      height: SKY_STRIP_HEIGHT,
      borderRadius: radii.lg,
      overflow: 'hidden',
      marginBottom: spacing.lg,
      ...shadow,
    },
    tileRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    tile: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      padding: spacing.md,
      ...shadow,
    },
    tileLabel: { ...typography.meta, marginBottom: 4 },
    tileValue: { fontSize: 22, fontWeight: '800' },
    tileBody: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, lineHeight: 19 },
    metaLine: { ...typography.meta, marginBottom: spacing.lg, lineHeight: 18 },
    actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl },
    cheerBtn: {
      height: 52,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.pill,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cheerBtnText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    heroCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: spacing.xl,
      ...shadow,
    },
    heroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
    ruleBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.background,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs,
    },
    ruleText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
    longestStreak: { ...typography.meta, marginTop: spacing.md },
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
    sectionTitle: { ...typography.sectionTitle, marginBottom: spacing.md },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    memberTapTarget: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
    avatarPhoto: { backgroundColor: colors.surface, overflow: 'hidden' },
    memberName: { fontSize: 14, color: colors.textPrimary, flex: 1 },
    memberStreakRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: spacing.sm },
    memberStreak: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
    nudgeBtn: {
      width: 30,
      height: 30,
      borderRadius: radii.pill,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inviteSection: { marginTop: spacing.lg },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: colors.background,
      borderRadius: radii.pill,
      paddingVertical: spacing.sm,
    },
    secondaryButtonText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  });
}
