import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
import { useAppTheme } from '../hooks/useAppTheme';
import { useAuth } from '../hooks/useAuth';
import { useGroups } from '../hooks/useGroups';
import { useHabits } from '../hooks/useHabits';
import { useChallenges } from '../hooks/useChallenges';
import { useNotifications } from '../hooks/useNotifications';
import { useRegisterScrollToTop } from '../hooks/useRegisterScrollToTop';
import { radii, spacing } from '../theme';

export default function CommunityScreen({ navigation }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const scrollRef = useRegisterScrollToTop('Community');

  const { user } = useAuth();
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

  const [groupsModalVisible, setGroupsModalVisible] = useState(false);
  const [challengesModalVisible, setChallengesModalVisible] = useState(false);
  const [createGroupVisible, setCreateGroupVisible] = useState(false);
  const [createChallengeVisible, setCreateChallengeVisible] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [selectedChallengeId, setSelectedChallengeId] = useState(null);
  const [friendsVisible, setFriendsVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [freezeInfoVisible, setFreezeInfoVisible] = useState(false);
  const { unreadCount } = useNotifications();

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
      Alert.alert('Could not update check-in', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleToggleCheckIn = async (challenge) => {
    const ok =
      challenge.trackingMode === 'COUNT'
        ? await addChallengeEntry(challenge.id, 1)
        : await toggleCheckIn(challenge);
    if (!ok) Alert.alert("Couldn't update today's log", 'Something went wrong — try again.');
  };

  const refresh = async () => {
    await Promise.all([refreshGroups(), refreshChallenges()]);
  };

  return (
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
              accessibilityLabel="Friends"
              onPress={() => setFriendsVisible(true)}
            >
              <MaterialCommunityIcons name="account-multiple-plus-outline" size={20} color={colors.accent} />
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

        <View style={styles.sectionHeader}>
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
            />
            );
          })
        )}

        <View style={[styles.sectionHeader, styles.laterSection]}>
          <Text style={styles.sectionTitle}>Challenges</Text>
          <View style={styles.sectionActions}>
            <Pressable
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
      />
      <ProtectionInfoModal
        visible={freezeInfoVisible}
        initialTab="freeze"
        onClose={() => setFreezeInfoVisible(false)}
      />
    </SafeAreaView>
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
