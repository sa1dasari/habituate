import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AvatarImage from './AvatarImage';
import FlameIcon from './FlameIcon';
import StreakIndicator from './StreakIndicator';
import { useAppTheme } from '../hooks/useAppTheme';
import api from '../api/client';
import { gradients, radii, shadow, shadowLg, spacing } from '../theme';

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

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
              sharedStreaks.map((group) => (
                <View key={group.groupId} style={styles.groupRow}>
                  <View style={styles.groupIcon}>
                    <MaterialCommunityIcons name="account-multiple-outline" size={16} color={colors.accent} />
                  </View>
                  <Text style={styles.groupName} numberOfLines={1}>
                    {group.groupName}
                  </Text>
                  <StreakIndicator streak={group.currentStreak} status={group.status} compact />
                </View>
              ))
            )}
          </ScrollView>
        ) : null}
      </SafeAreaView>
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
