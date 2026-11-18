import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DismissibleActivityRow from '../components/DismissibleActivityRow';
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
import { useAppTheme } from '../hooks/useAppTheme';
import { useAuth } from '../hooks/useAuth';
import { useGroups } from '../hooks/useGroups';
import { useHabits } from '../hooks/useHabits';
import { useChallenges } from '../hooks/useChallenges';
import { useGroupActivity } from '../hooks/useGroupActivity';
import { useFriends } from '../hooks/useFriends';
import { useNotifications } from '../hooks/useNotifications';
import { useRegisterScrollToTop } from '../hooks/useRegisterScrollToTop';
import { useToast } from '../hooks/useToast';
import { radii, spacing } from '../theme';

const AVATAR_COLORS = ['#2563EB', '#7C3AED', '#0891B2', '#DB2777', '#EA580C'];

export default function CommunityScreen({ navigation, route }) {
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
  const { activity, loading: activityLoading, toggleCheer, dismiss: dismissActivity } = useGroupActivity();

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

  // Board 08/09: Shared habits and Challenges are two tabs, not one long
  // scroll — "activeTab" replaces the old scroll-to-section behavior below.
  const [activeTab, setActiveTab] = useState('shared');

  // Coming from Profile's Challenges card "See all" — switch to the
  // Challenges tab instead of scrolling to a section that no longer exists.
  useFocusEffect(
    useCallback(() => {
      if (!route.params?.scrollToChallenges) return;
      setActiveTab('challenges');
      navigation.setParams({ scrollToChallenges: undefined });
    }, [route.params?.scrollToChallenges, navigation])
  );

  // Coming from Profile's Challenges card — tapping a specific challenge row
  // switches to the Challenges tab and opens that challenge's detail modal.
  useFocusEffect(
    useCallback(() => {
      if (!route.params?.openChallengeId) return;
      const challenge = challenges.find((c) => c.id === route.params.openChallengeId);
      if (challenge) {
        setActiveTab('challenges');
        setSelectedChallengeId(challenge.id);
      }
      navigation.setParams({ openChallengeId: undefined });
    }, [route.params?.openChallengeId, challenges, navigation])
  );

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

  // Row already slides/springs itself on swipe (DismissibleActivityRow) and
  // useGroupActivity's dismiss() already removes the item from local state
  // optimistically — this just surfaces a failure if the request didn't
  // actually stick (the hook's own catch already re-fetches to restore it).
  const handleDismissActivity = async (item) => {
    try {
      await dismissActivity(item);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't dismiss that — try again.", 'error');
    }
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

          <View style={styles.headerActions}>
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
          </View>
        </View>

        <View style={styles.tabPill} testID="community-tabs">
          <Pressable
            style={[styles.tabButton, activeTab === 'shared' && styles.tabButtonActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: activeTab === 'shared' }}
            onPress={() => setActiveTab('shared')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'shared' && styles.tabButtonTextActive]}>
              Shared habits
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, activeTab === 'challenges' && styles.tabButtonActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: activeTab === 'challenges' }}
            onPress={() => setActiveTab('challenges')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'challenges' && styles.tabButtonTextActive]}>
              Challenges
            </Text>
          </Pressable>
        </View>

        {activeTab !== 'shared' ? null : (
        <>
        <View style={styles.sectionHeader}>
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Streak freezes"
            onPress={() => setFreezeInfoVisible(true)}
          >
            <MaterialCommunityIcons name="snowflake" size={18} color={colors.frozen} />
          </Pressable>
          <View style={styles.sectionActions}>
            <Pressable
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

        <Text style={[styles.sectionTitle, styles.friendsTodayTitle]}>Friends today</Text>
        {activityLoading && activity.length === 0 ? (
          <View style={styles.loaderRow}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : activity.length === 0 ? (
          <Text style={styles.activityEmptyNote}>
            No groupmate activity yet — it'll show up here once someone checks in.
          </Text>
        ) : (
          <ScrollView style={styles.activityScroll} nestedScrollEnabled>
            {activity.map((item, index) => (
              <DismissibleActivityRow
                key={item.checkInId}
                item={item}
                styles={styles}
                colors={colors}
                avatarColor={AVATAR_COLORS[index % AVATAR_COLORS.length]}
                onCheer={() => handleToggleCheer(item)}
                onDismiss={() => handleDismissActivity(item)}
              />
            ))}
          </ScrollView>
        )}
        </>
        )}

        {activeTab !== 'challenges' ? null : (
        <>
        <View style={styles.sectionHeader}>
          <View />
          <View style={styles.sectionActions}>
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
              trackingMode={challenge.trackingMode}
              myProgress={challenge.myProgress}
              targetCount={challenge.targetCount}
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

        <Pressable
          style={styles.landmarkCta}
          accessibilityRole="button"
          accessibilityLabel="Raise a landmark"
          onPress={() => setCreateChallengeVisible(true)}
        >
          <View style={styles.landmarkCtaIcon}>
            <MaterialCommunityIcons name="plus" size={20} color="#F2C14E" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.landmarkCtaTitle}>Raise a landmark</Text>
            <Text style={styles.landmarkCtaBody}>A time-boxed goal everyone builds together.</Text>
          </View>
        </Pressable>

        <Text style={styles.landmarkFootnote}>
          Challenges and shared habits stay separate. A challenge ends on a date. When it ends, the
          landmark joins your skyline as a finished tower.
        </Text>
        </>
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
          navigation.navigate('Insights', {
            screen: 'InsightsMain',
            params: { periodNav: { period, anchorDate: periodStart || null } },
          });
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
    tabPill: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: radii.pill,
      padding: 4,
      marginBottom: spacing.lg,
    },
    tabButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.sm + 2,
      borderRadius: radii.pill,
    },
    tabButtonActive: { backgroundColor: colors.background },
    tabButtonText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
    tabButtonTextActive: { color: colors.textPrimary },
    landmarkCta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.border,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    landmarkCtaIcon: {
      width: 40,
      height: 40,
      borderRadius: radii.pill,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    landmarkCtaTitle: { ...typography.cardTitle, fontSize: 16 },
    landmarkCtaBody: { ...typography.meta, marginTop: 2 },
    landmarkFootnote: { ...typography.meta, lineHeight: 18 },
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
    friendsTodayTitle: { marginTop: spacing.lg },
    activityScroll: { maxHeight: 280 },
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
      gap: 4,
      height: 32,
      paddingHorizontal: spacing.sm + 2,
      borderRadius: radii.pill,
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    cheerBtnActive: { backgroundColor: colors.accentSoft },
    cheerBtnText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
    cheerBtnTextActive: { color: colors.accent },
    cheerCount: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
    // Swipe-to-dismiss (DismissibleActivityRow) — rowWrapper clips the
    // sliding row so the dismiss panel behind it never bleeds into a
    // neighboring row; the panels themselves grow with the drag distance,
    // same technique as NotificationCenterModal's NotificationRow.
    rowWrapper: { overflow: 'hidden' },
    sidePanel: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    leftPanel: { left: 0 },
    rightPanel: { right: 0 },
    // flex:1 + width:'100%' (not a fixed pixel width) so this matches its
    // animated parent (sidePanel)'s current width exactly, same as
    // NotificationCenterModal's actionBtn — sidePanel has no overflow:hidden
    // of its own, so a fixed-width child here would render at full size even
    // while the parent is animated to 0 at rest, bleeding into the row.
    dismissGlyph: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', gap: 2 },
    dismissGlyphText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
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
