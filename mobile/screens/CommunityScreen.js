import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import SharedHabitCard from '../components/SharedHabitCard';
import ChallengeCard from '../components/ChallengeCard';
import GroupsManageModal from '../components/GroupsManageModal';
import ChallengesManageModal from '../components/ChallengesManageModal';
import { DISPLAY_NAME, initials } from '../constants/profile';
import { useAppTheme } from '../hooks/useAppTheme';
import { useGroups } from '../hooks/useGroups';
import { useChallenges } from '../hooks/useChallenges';
import { radii, spacing } from '../theme';

export default function CommunityScreen() {
  const navigation = useNavigation();
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);

  const { groups, loading: groupsLoading, refresh: refreshGroups } = useGroups();
  const { challenges, loading: challengesLoading, busy: challengesBusy, refresh: refreshChallenges, toggleCheckIn } =
    useChallenges();

  const [groupsModalVisible, setGroupsModalVisible] = useState(false);
  const [challengesModalVisible, setChallengesModalVisible] = useState(false);

  const loading = groupsLoading || challengesLoading;

  const handleToggleCheckIn = async (challenge) => {
    const ok = await toggleCheckIn(challenge);
    if (!ok) Alert.alert("Couldn't update today's log", 'Something went wrong — try again.');
  };

  const refresh = async () => {
    await Promise.all([refreshGroups(), refreshChallenges()]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Community</Text>
            <Text style={styles.subtitle}>Shared habits, group streaks, and challenges</Text>
          </View>

          <Pressable
            style={styles.avatar}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.avatarText}>{initials(DISPLAY_NAME)}</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Shared Habits</Text>
          <View style={styles.sectionActions}>
            <Pressable
              style={styles.createBtn}
              accessibilityRole="button"
              accessibilityLabel="Create a shared habit"
              onPress={() => setGroupsModalVisible(true)}
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
          <EmptyCard
            styles={styles}
            iconColor={colors.textMuted}
            icon="account-group-outline"
            title="No shared habits yet"
            body="Create one with a friend to start a group streak."
            onPress={() => setGroupsModalVisible(true)}
          />
        ) : (
          groups.map((group) => (
            <SharedHabitCard
              key={group.id}
              name={group.name}
              participants={group.participants}
              participantCount={group.participantCount}
              streak={group.streak}
              streakStatus={group.streakStatus}
              rule={group.rule}
              onPress={() => setGroupsModalVisible(true)}
            />
          ))
        )}

        <Pressable style={styles.ctaCard} onPress={() => setGroupsModalVisible(true)}>
          <View style={styles.ctaIcon}>
            <MaterialCommunityIcons name="account-group-outline" size={20} color={colors.accent} />
          </View>
          <View style={styles.ctaText}>
            <Text style={styles.ctaTitle}>Create a Shared Habit</Text>
            <Text style={styles.ctaBody}>Invite a friend to track it together</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
        </Pressable>

        <View style={[styles.sectionHeader, styles.laterSection]}>
          <Text style={styles.sectionTitle}>Challenges</Text>
          <View style={styles.sectionActions}>
            <Pressable
              style={styles.createBtn}
              accessibilityRole="button"
              accessibilityLabel="Create a challenge"
              onPress={() => setChallengesModalVisible(true)}
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
            body="Browse public challenges or start your own."
            onPress={() => setChallengesModalVisible(true)}
          />
        ) : (
          challenges.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              name={challenge.name}
              myProgress={challenge.myProgress}
              targetCount={challenge.targetCount}
              progressPercent={challenge.progressPercent}
              participants={challenge.participants}
              participantCount={challenge.participantCount}
              joined={challenge.joined}
              checkedInToday={challenge.checkedInToday}
              busy={challengesBusy}
              onToggleCheckIn={() => handleToggleCheckIn(challenge)}
              onPress={() => setChallengesModalVisible(true)}
            />
          ))
        )}

        <Pressable style={styles.ctaCard} onPress={() => setChallengesModalVisible(true)}>
          <View style={styles.ctaIcon}>
            <MaterialCommunityIcons name="trophy-outline" size={20} color={colors.accent} />
          </View>
          <View style={styles.ctaText}>
            <Text style={styles.ctaTitle}>Create or Join Challenge</Text>
            <Text style={styles.ctaBody}>Invite friends to a new goal</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
        </Pressable>
      </ScrollView>

      <GroupsManageModal visible={groupsModalVisible} onClose={() => setGroupsModalVisible(false)} />
      <ChallengesManageModal visible={challengesModalVisible} onClose={() => setChallengesModalVisible(false)} />
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
    avatar: {
      width: 48,
      height: 48,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accentSoft,
    },
    avatarText: { fontSize: 16, fontWeight: '700', color: colors.accent },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
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
    ctaCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginTop: spacing.sm,
    },
    ctaIcon: {
      width: 40,
      height: 40,
      borderRadius: radii.md,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaText: { flex: 1 },
    ctaTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    ctaBody: { ...typography.meta, marginTop: 2 },
  });
}
