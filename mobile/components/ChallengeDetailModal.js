import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CreateChallengeModal from './CreateChallengeModal';
import InviteFriendsSheet from './InviteFriendsSheet';
import ScrubberInput from './ScrubberInput';
import AvatarImage from './AvatarImage';
import FriendProfileModal from './FriendProfileModal';
import LandmarkTowerGraphic from './LandmarkTowerGraphic';
import SkyBackdrop from './SkyBackdrop';
import HoldToBuildBar from './HoldToBuildBar';
import Toast from './Toast';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAuth } from '../hooks/useAuth';
import { useChallenges } from '../hooks/useChallenges';
import { useToast } from '../hooks/useToast';
import { radii, shadow, skyGradients, skylineTowerTheme, spacing } from '../theme';
import { daysUntil, formatDeadline, formatShortDate } from '../utils/date';
import { formatTime } from '../utils/time';

const AVATAR_COLORS = ['#2563EB', '#7C3AED', '#0891B2', '#DB2777', '#EA580C'];
const SKY_STRIP_HEIGHT = 230;

function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

const VISIBILITY_LABEL = { PUBLIC: 'Public', PRIVATE: 'Private' };

const WEEKDAY_LABELS = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };

function cadenceLabel(challenge) {
  if (challenge.cadenceType === 'WEEKLY_QUOTA') {
    return `${challenge.weeklyQuota || 1}x a week`;
  }
  if (challenge.cadenceType === 'CUSTOM_DAYS' && challenge.customDays) {
    return challenge.customDays
      .split(',')
      .map((d) => WEEKDAY_LABELS[Number(d.trim())])
      .filter(Boolean)
      .join(', ');
  }
  return 'Daily';
}

/** Detail view for one Challenge, opened by tapping its card — not the create/browse flow. */
export default function ChallengeDetailModal({ visible, challenge, onClose }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { user } = useAuth();
  const { toggleCheckIn, addChallengeEntry, inviteToChallenge, joinChallenge, busy } = useChallenges();
  const [inviteVisible, setInviteVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [entryAmount, setEntryAmount] = useState(1);
  const [profileUserId, setProfileUserId] = useState(null);
  const [stripWidth, setStripWidth] = useState(0);
  const { toast, showToast, hideToast } = useToast();

  if (!challenge) return null;

  // Most-checked-in-first: person.progress is the real check-in count toward
  // the target. .slice() so we never mutate the array the provider owns.
  const people = Array.isArray(challenge.participants)
    ? challenge.participants
        .slice()
        .sort((a, b) => {
          const progressA = typeof a === 'object' && a ? a.progress ?? -1 : -1;
          const progressB = typeof b === 'object' && b ? b.progress ?? -1 : -1;
          return progressB - progressA;
        })
    : [];
  // Avatar color assigned from each person's position in the ORIGINAL
  // (unsorted) participant order, not the post-sort render index — keeps
  // everyone's color stable instead of reshuffling whenever progress order
  // changes their rank.
  const colorKeyOf = (person, idx) => (typeof person === 'object' && person && person.userId) || `idx-${idx}`;
  const colorByKey = new Map(
    (Array.isArray(challenge.participants) ? challenge.participants : []).map((p, i) => [
      colorKeyOf(p, i),
      AVATAR_COLORS[i % AVATAR_COLORS.length],
    ])
  );
  const isCount = challenge.trackingMode === 'COUNT';

  // Board 11's landmark: contiguous per-contributor bands in the same
  // progress-sorted order "Who built what" lists them in below, so a band's
  // colour always matches its row's bar/avatar colour.
  const built = people.reduce((sum, p) => sum + Math.max(0, (typeof p === 'object' && p?.progress) || 0), 0);
  const contributors = people.map((p, i) => ({
    color: colorByKey.get(colorKeyOf(p, i)),
    floors: typeof p === 'object' && p ? Math.max(0, p.progress || 0) : 0,
  }));
  const daysLeft = challenge.periodEnd ? Math.max(0, daysUntil(challenge.periodEnd)) : null;
  const hasEnded = !!challenge.periodEnd && daysUntil(challenge.periodEnd) < 0;

  const handleToggle = async () => {
    try {
      if (isCount) await addChallengeEntry(challenge.id, entryAmount);
      else await toggleCheckIn(challenge);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't update today's log", 'error');
    }
  };

  const handleInvite = (friendUserId) => inviteToChallenge(challenge.id, friendUserId);

  const handleJoin = async () => {
    try {
      await joinChallenge(challenge.id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't join this challenge", 'error');
    }
  };

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
          <Text style={styles.headerTitle} numberOfLines={1}>
            {challenge.name}
          </Text>
          <View style={styles.headerActions}>
            {challenge.canEdit ? (
              <Pressable onPress={() => setEditVisible(true)} hitSlop={12} style={styles.closeBtn}>
                <MaterialCommunityIcons name="pencil-outline" size={20} color={colors.accent} />
              </Pressable>
            ) : null}
            <Pressable onPress={() => setInviteVisible(true)} hitSlop={12} style={styles.closeBtn}>
              <MaterialCommunityIcons name="account-plus-outline" size={22} color={colors.accent} />
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {challenge.description ? <Text style={styles.description}>{challenge.description}</Text> : null}

          <View style={styles.skyStrip} onLayout={(e) => setStripWidth(e.nativeEvent.layout.width)}>
            <View style={StyleSheet.absoluteFill}>
              {stripWidth > 0 ? (
                <SkyBackdrop stops={skyGradients.dark.night} kind="night" width={stripWidth} height={SKY_STRIP_HEIGHT} />
              ) : null}
            </View>
            {built > 0 ? (
              <View style={styles.floorCallout} pointerEvents="none">
                <Text style={styles.floorCalloutText}>Floor {built}</Text>
              </View>
            ) : null}
            <View style={styles.landmarkWrap}>
              <LandmarkTowerGraphic
                contributors={contributors}
                towerTheme={skylineTowerTheme.dark}
                width={110}
                height={SKY_STRIP_HEIGHT}
                testID="challenge-detail-landmark"
              />
            </View>
          </View>

          <View style={styles.tileRow}>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>Built</Text>
              <Text style={styles.tileValue}>
                {built} of {challenge.targetCount}
              </Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>Your part</Text>
              <Text style={styles.tileValue}>
                {challenge.myProgress}
                {isCount ? '' : ' floors'}
              </Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>Days left</Text>
              <Text style={styles.tileValue}>{daysLeft != null ? daysLeft : '—'}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaBadge}>
              <MaterialCommunityIcons name="calendar-range" size={13} color={colors.textSecondary} />
              <Text style={styles.metaText}>
                Started {formatShortDate(challenge.periodStart)} · {formatDeadline(challenge.periodEnd)}
              </Text>
            </View>
            <View style={styles.metaBadge}>
              <MaterialCommunityIcons
                name={challenge.visibility === 'PUBLIC' ? 'earth' : 'lock-outline'}
                size={13}
                color={colors.textSecondary}
              />
              <Text style={styles.metaText}>{VISIBILITY_LABEL[challenge.visibility] || 'Private'}</Text>
            </View>
            <View style={styles.metaBadge}>
              <MaterialCommunityIcons name="repeat" size={13} color={colors.textSecondary} />
              <Text style={styles.metaText}>{cadenceLabel(challenge)}</Text>
            </View>
            {challenge.reminderTime ? (
              <View style={styles.metaBadge}>
                <MaterialCommunityIcons name="bell-outline" size={13} color={colors.textSecondary} />
                <Text style={styles.metaText}>{formatTime(challenge.reminderTime)}</Text>
              </View>
            ) : null}
          </View>

          {challenge.joined ? (
            isCount ? (
              <View style={styles.entryRow}>
                <ScrubberInput value={entryAmount} onChange={setEntryAmount} min={1} max={9999} label="amount" />
                <Pressable style={styles.logButton} disabled={busy || hasEnded} onPress={handleToggle}>
                  <MaterialCommunityIcons name="plus" size={16} color={colors.accent} />
                  <Text style={styles.logButtonText}>{hasEnded ? 'Ended' : 'Log entry'}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.holdWrap}>
                <HoldToBuildBar
                  built={challenge.checkedInToday}
                  canBuild={!challenge.checkedInToday && !hasEnded}
                  onBuild={handleToggle}
                  label={hasEnded ? 'This challenge has ended' : 'Hold to add today\'s floor'}
                  builtLabel="Floor built today"
                  testID="challenge-hold-to-build"
                />
              </View>
            )
          ) : (
            <Pressable style={styles.joinButton} disabled={busy} onPress={handleJoin}>
              <Text style={styles.joinButtonText}>Join this challenge</Text>
            </Pressable>
          )}

          <Text style={styles.sectionTitle}>Who built what</Text>
          {people.map((person, index) => {
            const label = typeof person === 'string' ? person : person && person.name;
            const personUserId = typeof person === 'object' && person ? person.userId : null;
            const progress = typeof person === 'object' && person ? person.progress : null;
            const percent = typeof person === 'object' && person ? person.progressPercent : null;
            const theirCheckedInToday = typeof person === 'object' && person ? person.checkedInToday : false;
            const photoUrl = typeof person === 'object' && person ? person.photoUrl : null;
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
                      photoUrl
                        ? styles.avatarPhoto
                        : { backgroundColor: colorByKey.get(colorKeyOf(person, index)) || AVATAR_COLORS[index % AVATAR_COLORS.length] },
                    ]}
                  >
                    {photoUrl ? (
                      <AvatarImage uri={photoUrl} name={label} size={32} fontSize={13} />
                    ) : (
                      <Text style={styles.avatarText}>{initials(label)}</Text>
                    )}
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>
                      {label}
                      {isSelf ? ' (you)' : ''}
                    </Text>
                    {progress != null ? (
                      <View style={styles.memberProgressTrack}>
                        <View
                          style={[
                            styles.memberProgressFill,
                            {
                              width: `${Math.max(4, percent || 0)}%`,
                              backgroundColor: colorByKey.get(colorKeyOf(person, index)),
                            },
                          ]}
                        />
                      </View>
                    ) : null}
                  </View>
                </Pressable>
                {progress != null ? (
                  <Text style={styles.memberProgressText}>
                    {progress}/{challenge.targetCount}
                  </Text>
                ) : null}
                {!isCount && theirCheckedInToday ? (
                  <MaterialCommunityIcons name="check-circle" size={16} color={colors.safe} />
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
      </GestureHandlerRootView>
      <FriendProfileModal visible={!!profileUserId} userId={profileUserId} onClose={() => setProfileUserId(null)} />

      <InviteFriendsSheet
        visible={inviteVisible}
        onClose={() => setInviteVisible(false)}
        onInvite={handleInvite}
        busy={busy}
        title="Invite to challenge"
      />
      <CreateChallengeModal
        visible={editVisible}
        challenge={challenge}
        onClose={() => setEditVisible(false)}
        onDeleted={() => {
          setEditVisible(false);
          onClose();
        }}
      />
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
    headerTitle: { ...typography.sectionTitle, flex: 1, textAlign: 'center' },
    headerActions: { flexDirection: 'row', alignItems: 'center' },
    closeBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
    description: { ...typography.body, marginBottom: spacing.md },
    skyStrip: {
      height: SKY_STRIP_HEIGHT,
      borderRadius: radii.lg,
      overflow: 'hidden',
      marginBottom: spacing.lg,
      alignItems: 'center',
      justifyContent: 'flex-end',
      ...shadow,
    },
    landmarkWrap: { paddingBottom: spacing.sm },
    floorCallout: {
      position: 'absolute',
      top: spacing.lg,
      alignSelf: 'center',
      backgroundColor: 'rgba(0,0,0,0.35)',
      borderRadius: radii.pill,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: 'rgba(255,255,255,0.6)',
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs,
    },
    floorCalloutText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
    tileRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    tile: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      padding: spacing.md,
      ...shadow,
    },
    tileLabel: { ...typography.meta, marginBottom: 4 },
    tileValue: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
    holdWrap: { marginBottom: spacing.xl },
    joinButton: {
      backgroundColor: colors.accent,
      borderRadius: radii.pill,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    joinButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
    metaBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.background,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs,
    },
    metaText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
    entryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.xl },
    logButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: colors.accentSoft,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
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
    memberInfo: { flex: 1 },
    memberName: { fontSize: 14, color: colors.textPrimary },
    memberProgressTrack: {
      height: 4,
      borderRadius: radii.pill,
      backgroundColor: colors.ringTrack,
      overflow: 'hidden',
      marginTop: 4,
      width: '80%',
    },
    memberProgressFill: { height: '100%', borderRadius: radii.pill, backgroundColor: colors.accent },
    memberProgressText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginRight: spacing.xs },
  });
}
