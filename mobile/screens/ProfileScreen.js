import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AvatarImage from '../components/AvatarImage';
import EditProfileModal from '../components/EditProfileModal';
import { categoryIcon } from '../constants/habitCategories';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAuth } from '../hooks/useAuth';
import { useHabits } from '../hooks/useHabits';
import { useGroupActivity } from '../hooks/useGroupActivity';
import { unregisterPushToken } from '../hooks/usePushToken';
import { computeConsistency } from '../utils/consistency';
import { timeAgo } from '../utils/date';
import { radii, shadow, spacing } from '../theme';

const HABIT_SUMMARY_LIMIT = 3;
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

function Card({ title, actionLabel, onAction, children, styles }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {actionLabel ? (
          <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={actionLabel}>
            <Text style={styles.cardAction}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { user, signOut } = useAuth();
  const { habits } = useHabits();
  const { activity, loading: activityLoading, toggleCheer } = useGroupActivity();

  const [editVisible, setEditVisible] = useState(false);

  const displayName = user?.displayName || 'there';
  const firstName = displayName.split(' ')[0];
  const weeklyConsistency = useMemo(() => computeConsistency(habits, 'weekly').percent, [habits]);

  const handleToggleCheer = async (item) => {
    const ok = await toggleCheer(item);
    if (!ok) Alert.alert("Couldn't update that", 'Something went wrong — try again.');
  };

  const handleSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await unregisterPushToken();
          await signOut();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Profile</Text>
            <Text style={styles.subtitle}>Your rhythm, your way.</Text>
          </View>
          <Pressable
            style={styles.editBtn}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
            onPress={() => setEditVisible(true)}
          >
            <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.accent} />
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.avatarLg}>
            <AvatarImage uri={user?.photoURL} name={displayName} size={52} fontSize={18} />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>Hi {firstName}, you're doing great.</Text>
            <Text style={styles.heroSubtitle}>
              {habits.length} {habits.length === 1 ? 'habit' : 'habits'} tracked · {weeklyConsistency}% weekly
              consistency
            </Text>
          </View>
        </View>

        <Card
          title="Personal habit summary"
          actionLabel="View all"
          onAction={() => navigation.navigate('Habits')}
          styles={styles}
        >
          {habits.length === 0 ? (
            <Text style={styles.emptyNote}>Add a habit on the Habits tab to see it here.</Text>
          ) : (
            habits.slice(0, HABIT_SUMMARY_LIMIT).map((habit) => {
              const target = habit.periodTarget || 0;
              const done = habit.periodDone || 0;
              const percent = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
              return (
                <View key={habit.id} style={styles.habitRow}>
                  <View style={styles.habitIcon}>
                    <MaterialCommunityIcons name={categoryIcon(habit.category)} size={18} color={colors.accent} />
                  </View>
                  <View style={styles.habitInfo}>
                    <Text style={styles.habitName} numberOfLines={1}>
                      {habit.name}
                    </Text>
                    <Text style={styles.habitMeta}>{habit.progressLabel}</Text>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${Math.max(4, percent)}%` }]} />
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </Card>

        <Card
          title="Shared progress"
          actionLabel="See all"
          onAction={() => navigation.navigate('Community')}
          styles={styles}
        >
          {activityLoading && activity.length === 0 ? (
            <View style={styles.loaderRow}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          ) : activity.length === 0 ? (
            <Text style={styles.emptyNote}>No groupmate activity yet — it'll show up here once someone checks in.</Text>
          ) : (
            activity.slice(0, ACTIVITY_LIMIT).map((item, index) => (
              <View key={item.checkInId} style={styles.activityRow}>
                <View style={[styles.avatar, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
                  <Text style={styles.avatarText}>{initials(item.userName)}</Text>
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
                </Pressable>
              </View>
            ))
          )}
        </Card>

        <Pressable style={styles.settingsRow} onPress={() => navigation.navigate('AccountSettings')}>
          <View style={styles.settingsRowIcon}>
            <MaterialCommunityIcons name="cog-outline" size={18} color={colors.accent} />
          </View>
          <Text style={styles.settingsRowLabel}>Account Settings</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
        </Pressable>

        <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
          <MaterialCommunityIcons name="logout" size={16} color={colors.atRisk} />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>

      <EditProfileModal visible={editVisible} onClose={() => setEditVisible(false)} />
    </SafeAreaView>
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
    editBtn: {
      width: 40,
      height: 40,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      ...shadow,
    },
    heroCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      ...shadow,
    },
    avatarLg: {
      width: 52,
      height: 52,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accentSoft,
    },
    avatarLgText: { fontSize: 18, fontWeight: '700', color: colors.accent },
    heroText: { flex: 1 },
    heroTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    heroSubtitle: { ...typography.meta, marginTop: 2 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      ...shadow,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    cardTitle: { ...typography.cardTitle },
    cardAction: { fontSize: 13, fontWeight: '600', color: colors.accent },
    cardNote: { ...typography.meta, marginBottom: spacing.md },
    emptyNote: { ...typography.meta },
    loaderRow: { alignItems: 'center', paddingVertical: spacing.md },
    habitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    habitIcon: {
      width: 36,
      height: 36,
      borderRadius: radii.md,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    habitInfo: { flex: 1 },
    habitName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    habitMeta: { ...typography.meta, marginTop: 1, marginBottom: spacing.xs },
    progressTrack: {
      height: 6,
      borderRadius: radii.pill,
      backgroundColor: colors.ringTrack,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: radii.pill,
      backgroundColor: colors.safe,
    },
    activityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
    activityText: { flex: 1 },
    activityLine: { fontSize: 13, color: colors.textPrimary, lineHeight: 18 },
    activityName: { fontWeight: '700' },
    activityMeta: { ...typography.meta, marginTop: 1 },
    cheerBtn: {
      width: 32,
      height: 32,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    settingsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      marginBottom: spacing.lg,
      ...shadow,
    },
    settingsRowIcon: {
      width: 32,
      height: 32,
      borderRadius: radii.md,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    settingsRowLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
    signOutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
      marginTop: spacing.sm,
    },
    signOutText: { fontSize: 14, fontWeight: '700', color: colors.atRisk },
  });
}
