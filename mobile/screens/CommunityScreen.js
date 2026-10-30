import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AvatarImage from '../components/AvatarImage';
import SharedHabitCard from '../components/SharedHabitCard';
import ChallengeCard from '../components/ChallengeCard';
import GroupsManageModal from '../components/GroupsManageModal';
import ChallengesManageModal from '../components/ChallengesManageModal';
import CreateGroupModal from '../components/CreateGroupModal';
import CreateChallengeModal from '../components/CreateChallengeModal';
import SharedHabitDetailModal from '../components/SharedHabitDetailModal';
import ChallengeDetailModal from '../components/ChallengeDetailModal';
import AddFriendModal from '../components/AddFriendModal';
import NotificationCenterModal from '../components/NotificationCenterModal';
import ProtectionInfoModal from '../components/ProtectionInfoModal';
import FriendProfileModal from '../components/FriendProfileModal';
import Toast from '../components/Toast';
import TourHighlight from '../components/TourHighlight';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAuth } from '../hooks/useAuth';
import { useGroups } from '../hooks/useGroups';
import { useHabits } from '../hooks/useHabits';
import { useChallenges } from '../hooks/useChallenges';
import { useGroupActivity } from '../hooks/useGroupActivity';
import { useFriends } from '../hooks/useFriends';
import { useNotifications } from '../hooks/useNotifications';
import { useRegisterScrollToTop } from '../hooks/useRegisterScrollToTop';
import { useOnboardingTour } from '../hooks/useOnboardingTour';
import { useToast } from '../hooks/useToast';
import { useTourTarget } from '../hooks/useTourTarget';
import { TOUR_SCOPES, TOUR_TARGETS } from '../constants/onboardingTour';
import { timeAgo } from '../utils/date';
import { radii, spacing } from '../theme';

const ACTIVITY_LIMIT = 5;
const AVATAR_COLORS = ['#2563EB', '#7C3AED', '#0891B2', '#DB2777', '#EA580C'];

function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export default function CommunityScreen({ navigation }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const scrollRef = useRegisterScrollToTop('Community');

  const { user } = useAuth();
  const { pendingRequests: pendingFriendRequests } = useFriends();
  const { groups, loading: groupsLoading, refresh: refreshGroups } = useGroups();
  const { toggleCheckIn: toggleHabitCheckIn, busy: habitsBusy } = useHabits();
  const {
    challenges,
    loading: challengesLoading,
    busy: challengesBusy,
    refresh: refreshChallenges,
    toggleCheckIn,
    addChallengeEntry,
  } = useChallenges();
  const { activity, loading: activityLoading, toggleCheer } = useGroupActivity();

  const [groupsModalVisible, setGroupsModalVisible] = useState(false);
  const [challengesModalVisible, setChallengesModalVisible] = useState(false);
  const [createGroupVisible, setCreateGroupVisible] = useState(false);
  const [createChallengeVisible, setCreateChallengeVisible] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [selectedChallengeId, setSelectedChallengeId] = useState(null);
  const [friendsVisible, setFriendsVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [freezeInfoVisible, setFreezeInfoVisible] = useState(false);
  const [profileUserId, setProfileUserId] = useState(null);
  const { unreadCount } = useNotifications();
  const { toast, showToast, hideToast } = useToast();

  // Tapping the compact avatar stack on a card opens the friend-profile viewer instead of the
  // card's own onPress (e.g. the Shared Habit/Challenge detail modal) — never for yourself.
  const handlePressPerson = (userId) => {
    if (!userId || (user && userId === user.uid)) return;
    setProfileUserId(userId);
  };

  const { active: tourActive, currentStep: tourStep } = useOnboardingTour();
  const tourHeaderActionsRef = useTourTarget(TOUR_TARGETS.COMMUNITY_HEADER_ACTIONS);
  const tourCreateGroupRef = useTourTarget(TOUR_TARGETS.COMMUNITY_CREATE_GROUP);
  const tourCreateChallengeRef = useTourTarget(TOUR_TARGETS.COMMUNITY_CREATE_CHALLENGE);

  // Real-screen tour steps: opens the actual Create Shared Habit / Create
  // Challenge / streak-freeze-info modals in step with the walkthrough, and
  // reverts all three the moment the tour ends so it never leaves one open
  // behind the tour's back.
  useEffect(() => {
    if (!tourActive) {
      setCreateGroupVisible(false);
      setCreateChallengeVisible(false);
      setFreezeInfoVisible(false);
      return;
    }
    setCreateGroupVisible(tourStep?.id === 'shared-habit-form');
    setCreateChallengeVisible(tourStep?.id === 'challenge-form');
    setFreezeInfoVisible(tourStep?.id === 'streak-freeze-info');
  }, [tourActive, tourStep]);

  const loading = groupsLoading || challengesLoading;
  // Looked up by id each render (not the tapped object itself) so the detail
  // modal reflects the latest streak/progress after an action inside it.
  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || null;
  const selectedChallenge = challenges.find((c) => c.id === selectedChallengeId) || null;

  // Mirrors the fix in SharedHabitDetailModal — toggleHabitCheckIn only refreshes useHabits'
  // own list, so the groups list (and this card's checkedInToday) needs its own refresh too.
  const handleToggleGroupCheckIn = async (group) => {
    if (!group.myHabitId) return;
    try {
      await toggleHabitCheckIn(group.myHabitId);
      await refreshGroups();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update check-in.', 'error');
    }
  };

  const handleToggleCheckIn = async (challenge) => {
    try {
      if (challenge.trackingMode === 'COUNT') await addChallengeEntry(challenge.id, 1);
      else await toggleCheckIn(challenge);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't update today's log — try again.", 'error');
    }
  };

  const refresh = async () => {
    await Promise.all([refreshGroups(), refreshChallenges()]);
  };

  const handleToggleCheer = async (item) => {
    try {
      await toggleCheer(item);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't update that — try again.", 'error');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  return (
    <>
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Community</Text>
            <Text style={styles.subtitle}>Shared habits, group streaks, and challenges</Text>
          </View>

          <View style={styles.headerActions} ref={tourHeaderActionsRef}>
            <Pressable
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel="Friends"
              onPress={() => setFriendsVisible(true)}
            >
              <MaterialCommunityIcons name="account-multiple-plus-outline" size={20} color={colors.accent} />
              {pendingFriendRequests.length > 0 ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {pendingFriendRequests.length > 9 ? '9+' : pendingFriendRequests.length}
                  </Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              onPress={() => setNotificationsVisible(true)}
            >
              <MaterialCommunityIcons name="bell-outline" size={20} color={colors.accent} />
              {unreadCount > 0 ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>

        <View style={[styles.sectionHeader, styles.activitySectionHeader]}>
          <Text style={styles.sectionTitle}>Recent activity</Text>
        </View>

        {activityLoading && activity.length === 0 ? (
          <View style={styles.loaderRow}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : activity.length === 0 ? (
          <Text style={styles.activityEmptyNote}>
            No groupmate activity yet — it'll show up here once someone checks in.
          </Text>
        ) : (
          <View style={styles.activityCard}>
            {activity.slice(0, ACTIVITY_LIMIT).map((item, index) => (
              <View key={item.checkInId} style={styles.activityRow}>
                <View
                  style={[
                    styles.activityAvatar,
                    item.userPhotoUrl
                      ? styles.activityAvatarPhoto
                      : { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] },
                  ]}
                >
                  {item.userPhotoUrl ? (
                    <AvatarImage uri={item.userPhotoUrl} name={item.userName} size={32} fontSize={13} />
                  ) : (
                    <Text style={styles.activityAvatarText}>{initials(item.userName)}</Text>
                  )}
                </View>
                <View style={styles.activityText}>
                  <Text style={styles.activityLine} numberOfLines={2}>
                    <Text style={styles.activityName}>{item.userName}</Text>{' '}
                    {item.value != null && item.value > 1
                      ? `logged ${item.value} for ${item.habitName}`
                      : `completed ${item.habitName}`}
                  </Text>
                  <Text style={styles.activityMeta}>{timeAgo(item.occurredAt)}</Text>
                </View>
                <Pressable
                  style={styles.cheerBtn}
                  accessibilityRole="button"
                  accessibilityLabel={item.cheeredByMe ? 'Remove cheer' : 'Cheer'}
                  onPress={() => handleToggleCheer(item)}
                >
                  <MaterialCommunityIcons
                    name={item.cheeredByMe ? 'heart' : 'heart-outline'}
                    size={18}
                    color={item.cheeredByMe ? colors.atRisk : colors.textMuted}
                  />
                  {item.cheerCount > 0 ? <Text style={styles.cheerCount}>{item.cheerCount}</Text> : null}
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.sectionHeader, styles.laterSection]}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Shared Habits</Text>
            <Pressable
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Streak freezes"
              onPress={() => setFreezeInfoVisible(true)}
            >
              <MaterialCommunityIcons name="snowflake" size={18} color={colors.frozen} />
            </Pressable>
          </View>
          <View style={styles.sectionActions}>
            <Pressable
              ref={tourCreateGroupRef}
              style={styles.createBtn}
              accessibilityRole="button"
              accessibilityLabel="Create a shared habit"
              onPress={() => setCreateGroupVisible(true)}
            >
              <MaterialCommunityIcons name="plus" size={16} color={colors.accent} />
              <Text style={styles.createBtnText}>Create</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Manage shared habits"
              onPress={() => setGroupsModalVisible(true)}
            >
              <Text style={styles.sectionLink}>See all</Text>
            </Pressable>
          </View>
        </View>

        {loading && groups.length === 0 ? (
          <View style={styles.loaderRow}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : groups.length === 0 ? (
          <>
            <EmptyCard
              styles={styles}
              iconColor={colors.textMuted}
              icon="account-group-outline"
              title="No shared habits yet"
              body="Track a habit together with a friend and keep each other going."
              onPress={() => setCreateGroupVisible(true)}
            />
            <Pressable style={styles.friendPrompt} onPress={() => setFriendsVisible(true)}>
              <MaterialCommunityIcons name="account-plus-outline" size={15} color={colors.accent} />
              <Text style={styles.friendPromptText}>No one to share with yet? Add a friend</Text>
            </Pressable>
          </>
        ) : (
          groups.map((group) => {
            const myParticipant = (group.participants || []).find(
              (p) => typeof p === 'object' && p && user && p.userId === user.uid
            );
            return (
            <SharedHabitCard
              key={group.id}
              name={group.name}
              participants={group.participants}
              participantCount={group.participantCount}
              streak={group.streak}
              streakStatus={group.streakStatus}
              rule={group.rule}
              trackingMode={group.trackingMode}
              myHabitId={group.myHabitId}
              checkedInToday={myParticipant ? myParticipant.checkedInToday : false}
              onToggleCheckIn={() => handleToggleGroupCheckIn(group)}
              busy={habitsBusy}
              onPress={() => setSelectedGroupId(group.id)}
              onPressPerson={handlePressPerson}
            />
            );
          })
        )}

        <View style={[styles.sectionHeader, styles.laterSection]}>
          <Text style={styles.sectionTitle}>Challenges</Text>
          <View style={styles.sectionActions}>
            <Pressable
              ref={tourCreateChallengeRef}
              style={styles.createBtn}
              accessibilityRole="button"
              accessibilityLabel="Create a challenge"
              onPress={() => setCreateChallengeVisible(true)}
            >
              <MaterialCommunityIcons name="plus" size={16} color={colors.accent} />
              <Text style={styles.createBtnText}>Create</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Browse challenges"
              onPress={() => setChallengesModalVisible(true)}
            >
              <Text style={styles.sectionLink}>Browse</Text>
            </Pressable>
          </View>
        </View>

        {loading && challenges.length === 0 ? (
          <View style={styles.loaderRow}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : challenges.length === 0 ? (
          <EmptyCard
            styles={styles}
            iconColor={colors.textMuted}
            icon="trophy-outline"
            title="No challenges yet"
            body="Join a public challenge, or start one for you and your friends."
            onPress={() => setChallengesModalVisible(true)}
          />
        ) : (
          challenges.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              name={challenge.name}
              icon={challenge.icon}
              color={challenge.color}
              trackingMode={challenge.trackingMode}
              myProgress={challenge.myProgress}
              targetCount={challenge.targetCount}
              progressPercent={challenge.progressPercent}
              participants={challenge.participants}
              participantCount={challenge.participantCount}
              joined={challenge.joined}
              checkedInToday={challenge.checkedInToday}
              busy={challengesBusy}
              onToggleCheckIn={() => handleToggleCheckIn(challenge)}
              onPress={() => setSelectedChallengeId(challenge.id)}
              onPressPerson={handlePressPerson}
            />
          ))
        )}

      </ScrollView>

      <GroupsManageModal visible={groupsModalVisible} onClose={() => setGroupsModalVisible(false)} />
      <ChallengesManageModal visible={challengesModalVisible} onClose={() => setChallengesModalVisible(false)} />
      <CreateGroupModal visible={createGroupVisible} onClose={() => setCreateGroupVisible(false)} />
      <CreateChallengeModal visible={createChallengeVisible} onClose={() => setCreateChallengeVisible(false)} />
      <SharedHabitDetailModal
        visible={!!selectedGroup}
        group={selectedGroup}
        onClose={() => setSelectedGroupId(null)}
      />
      <ChallengeDetailModal
        visible={!!selectedChallenge}
        challenge={selectedChallenge}
        onClose={() => setSelectedChallengeId(null)}
      />
      <AddFriendModal visible={friendsVisible} onClose={() => setFriendsVisible(false)} />
      <NotificationCenterModal
        visible={notificationsVisible}
        onClose={() => setNotificationsVisible(false)}
        onOpenGroup={setSelectedGroupId}
        onOpenChallenge={setSelectedChallengeId}
        onOpenInsightsPeriod={(period, periodStart) => {
          navigation.navigate('Insights', { periodNav: { period, anchorDate: periodStart || null } });
        }}
        onOpenFriends={() => setFriendsVisible(true)}
      />
      <ProtectionInfoModal
        visible={freezeInfoVisible}
        initialTab="freeze"
        onClose={() => setFreezeInfoVisible(false)}
      />
      <FriendProfileModal visible={!!profileUserId} userId={profileUserId} onClose={() => setProfileUserId(null)} />
      <Toast toast={toast} onHide={hideToast} />
    </SafeAreaView>
    <TourHighlight scope={TOUR_SCOPES.COMMUNITY} />
    </>
  );
}

function EmptyCard({ icon, iconColor, title, body, onPress, styles }) {
  return (
    <Pressable style={styles.emptyCard} onPress={onPress}>
      <MaterialCommunityIcons name={icon} size={28} color={iconColor} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </Pressable>
  );
}

function makeStyles(colors, typography) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    container: { padding: spacing.xl, paddingBottom: spacing.xxl },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xl,
    },
    headerText: { flex: 1 },
    title: { ...typography.screenTitle },
    subtitle: { ...typography.meta, marginTop: 2 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: radii.pill,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notificationBadge: {
      position: 'absolute',
      top: -2,
      right: -2,
      minWidth: 18,
      height: 18,
      borderRadius: radii.pill,
      backgroundColor: colors.atRisk,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
      borderWidth: 1.5,
      borderColor: colors.background,
    },
    notificationBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accentSoft,
      overflow: 'hidden',
    },
    avatarPhoto: { width: 48, height: 48, borderRadius: radii.pill },
    avatarText: { fontSize: 16, fontWeight: '700', color: colors.accent },
    activitySectionHeader: { marginTop: spacing.sm },
    activityCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    activityEmptyNote: { ...typography.meta, marginBottom: spacing.md },
    activityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    activityAvatar: {
      width: 32,
      height: 32,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    activityAvatarPhoto: { backgroundColor: colors.surface },
    activityAvatarText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
    activityText: { flex: 1 },
    activityLine: { fontSize: 13, color: colors.textPrimary, lineHeight: 18 },
    activityName: { fontWeight: '700' },
    activityMeta: { ...typography.meta, marginTop: 1 },
    cheerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      width: 'auto',
      height: 32,
      minWidth: 32,
      paddingHorizontal: spacing.xs,
      borderRadius: radii.pill,
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    cheerCount: { ...typography.meta, fontSize: 11 },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    sectionTitle: { ...typography.sectionTitle, fontSize: 18 },
    sectionActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    sectionLink: { fontSize: 14, fontWeight: '600', color: colors.accent },
    createBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      backgroundColor: colors.accentSoft,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs,
    },
    createBtnText: { fontSize: 13, fontWeight: '700', color: colors.accent },
    laterSection: { marginTop: spacing.lg },
    loaderRow: { alignItems: 'center', paddingVertical: spacing.lg },
    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.xl,
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    emptyTitle: { ...typography.cardTitle, marginTop: spacing.sm, marginBottom: spacing.xs },
    emptyBody: { ...typography.meta, textAlign: 'center' },
    friendPrompt: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      marginBottom: spacing.md,
    },
    friendPromptText: { fontSize: 13, fontWeight: '600', color: colors.accent },
  });
}
