import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AvatarImage from '../components/AvatarImage';
import EditProfileModal from '../components/EditProfileModal';
import MyStatsModal from '../components/MyStatsModal';
import PaywallSheet from '../components/PaywallSheet';
import ShareSheet from '../components/ShareSheet';
import AddFriendModal from '../components/AddFriendModal';
import ConfirmModal from '../components/ConfirmModal';
import Toast from '../components/Toast';
import { HABIT_CATEGORY_COLORS } from '../constants/habitCategories';
import { resolveHabitColor } from '../constants/towerColors';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAuth } from '../hooks/useAuth';
import { useConfirm } from '../hooks/useConfirm';
import { useEntitlement } from '../hooks/useEntitlement';
import { useFriends } from '../hooks/useFriends';
import { useHabits } from '../hooks/useHabits';
import { useShowFinishedTowers } from '../hooks/useShowFinishedTowers';
import { useTapToBuild } from '../hooks/useTapToBuild';
import { unregisterPushToken } from '../hooks/usePushToken';
import { useRegisterScrollToTop } from '../hooks/useRegisterScrollToTop';
import { useToast } from '../hooks/useToast';
import api from '../api/client';
import { buildCategoryTowerColors, fonts, radii, shadow, spacing } from '../theme';
import { countByCap, FREE_SHIELD_BANK_LIMIT, FREE_TIER_LIMITS } from '../utils/entitlements';

const PREVIEW_TOWER_LIMIT = 6;
const towerColorsByMode = buildCategoryTowerColors(HABIT_CATEGORY_COLORS);

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/**
 * Restyled per design-review board 15 (owner-approved, confirmed 2026-11-20):
 * a "Your skyline so far" hero (a flat-color tower-count preview, not a real
 * buildScene render — these bars only need to convey relative current run
 * and which tower holds the best run, not the full window/floor detail a
 * real tower scene carries) replacing the old "Hi {name}, you're doing
 * great" habit-list card, then flat settings rows instead of the old nested
 * "Account Settings" single entry point. Friends/Accessibility/Notifications/
 * Privacy/Skyline are now direct top-level rows; AccountSettingsScreen itself
 * is untouched and still reachable via the new "Account" row, so nothing
 * that deep-links into it elsewhere breaks.
 */
export default function ProfileScreen() {
  const navigation = useNavigation();
  const { colors, typography, effectiveMode } = useAppTheme();
  const { showFinishedTowers } = useShowFinishedTowers();
  const { tapToBuild } = useTapToBuild();
  const { friends, pendingRequests } = useFriends();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const scrollRef = useRegisterScrollToTop('Profile');
  const { user, signOut } = useAuth();
  const { habits, archivedHabits, shieldsAvailable } = useHabits();
  const { isPro } = useEntitlement();
  const capCounts = useMemo(() => countByCap(habits), [habits]);

  const [editVisible, setEditVisible] = useState(false);
  const [myStatsVisible, setMyStatsVisible] = useState(false);
  const [friendsVisible, setFriendsVisible] = useState(false);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const { toast, hideToast } = useToast();
  const { request, confirm, respond } = useConfirm();

  const displayName = user?.displayName || 'there';

  // username/profileVisibility aren't on the auth user object — same fetch
  // EditProfileModal/PrivacyScreen already make for the same two fields.
  const [username, setUsername] = useState(null);
  const [profileVisibility, setProfileVisibility] = useState('PRIVATE');
  const [finishedCount, setFinishedCount] = useState(null);
  const [bestRun, setBestRun] = useState(null);

  // Re-fetch on every focus, not just mount — this is a tab screen React
  // Navigation keeps mounted, so a mount-only effect would never notice a
  // tower retired/topped-out or a visibility change made in the Privacy
  // screen until the app restarted. showFinishedTowers/tapToBuild don't need
  // this (context-backed, already live); these three plain fetches do.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      api
        .getUserProfile()
        .then((profile) => {
          if (cancelled) return;
          setUsername(profile?.username || null);
          if (profile?.profileVisibility) setProfileVisibility(profile.profileVisibility);
        })
        .catch(() => {});
      api
        .listFinishedTowers()
        .then((list) => {
          if (!cancelled) setFinishedCount((list || []).length);
        })
        .catch(() => {
          if (!cancelled) setFinishedCount(0);
        });
      api
        .getMyStats()
        .then((stats) => {
          if (!cancelled) setBestRun(stats?.bestLongestStreak ?? 0);
        })
        .catch(() => {
          if (!cancelled) setBestRun(0);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const categoryColors = towerColorsByMode[effectiveMode];
  const previewHabits = habits.slice(0, PREVIEW_TOWER_LIMIT);
  const maxRun = Math.max(1, ...previewHabits.map((h) => h.currentRun || 0));
  const flagHabitId = previewHabits.length
    ? previewHabits.reduce((best, h) => ((h.bestRun || 0) > (best.bestRun || 0) ? h : best), previewHabits[0]).id
    : null;

  const handleSignOut = async () => {
    const ok = await confirm({
      title: 'Sign out?',
      message: 'You can sign back in anytime.',
      confirmLabel: 'Sign out',
      destructive: true,
    });
    if (!ok) return;
    await unregisterPushToken();
    await signOut();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Pressable
            style={styles.editBtn}
            onPress={() => setEditVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
          >
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        </View>

        <View style={styles.identityRow}>
          <AvatarImage uri={user?.photoURL} name={displayName} size={52} fontSize={18} />
          <View style={{ flex: 1 }}>
            <Text style={styles.identityName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.identityMeta} numberOfLines={1}>
              {username ? `@${username} · ` : ''}Profile: {profileVisibility === 'PUBLIC' ? 'Public' : 'Private'}
            </Text>
          </View>
        </View>

        <Pressable
          style={styles.heroCard}
          onPress={() => setMyStatsVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="View my stats"
        >
          <Text style={styles.heroTitle}>Your skyline so far</Text>
          {previewHabits.length > 0 ? (
            <View style={styles.previewRow}>
              {previewHabits.map((h) => {
                const run = h.currentRun || 0;
                const heightPct = Math.max(0.18, run / maxRun);
                return (
                  <View key={h.id} style={styles.previewTowerWrap}>
                    {h.id === flagHabitId ? (
                      <MaterialCommunityIcons name="flag-variant" size={14} color={colors.amber || '#F2C14E'} style={styles.previewFlag} />
                    ) : null}
                    <View
                      style={[
                        styles.previewTower,
                        {
                          height: Math.round(70 * heightPct),
                          backgroundColor: resolveHabitColor(h, effectiveMode, categoryColors),
                        },
                      ]}
                    />
                  </View>
                );
              })}
            </View>
          ) : null}
          <View style={styles.statsRow}>
            <StatChip value={habits.length} label="building" styles={styles} />
            <StatChip value={finishedCount ?? 0} label="finished" styles={styles} />
            <StatChip value={archivedHabits.length} label="monument" styles={styles} />
            <StatChip value={bestRun ?? 0} label="best run" styles={styles} />
          </View>
          {!isPro ? (
            <Text style={styles.planLine} testID="profile-plan-usage-line">
              {`Free plan · ${capCounts.daily} of ${FREE_TIER_LIMITS.daily} daily · ${capCounts.weekly} of ${FREE_TIER_LIMITS.weekly} weekly · ${capCounts.monthly} of ${FREE_TIER_LIMITS.monthly} monthly · ${shieldsAvailable} of ${FREE_SHIELD_BANK_LIMIT} Shield Days`}
            </Text>
          ) : null}
        </Pressable>

        {!isPro ? (
          <SettingsRow
            icon="star-outline"
            label="Unlock everything"
            // Board 89 predates the lifetime+monthly pivot (2026-11-24) and
            // still says "Lifetime purchase, pay once" — now false, since
            // this row opens a sheet offering both. Judgment-call fix
            // (mirrors the plan cards' own "Pay once"/"Cancel any time"
            // framing) pending design confirmation, same as paywallCopy
            // 'browse' below.
            sublabel="Pay once or go monthly"
            onPress={() => setPaywallVisible(true)}
            styles={styles}
            colors={colors}
            amber
            testID="profile-unlock-row"
          />
        ) : null}
        <SettingsRow
          icon="share-variant-outline"
          label="Share my skyline"
          sublabel="Square, Story or short clip"
          onPress={() => setShareSheetVisible(true)}
          styles={styles}
          colors={colors}
          testID="profile-share-skyline-row"
        />
        <SettingsRow
          icon="account-group-outline"
          label="Friends"
          sublabel={`${friends.length} ${friends.length === 1 ? 'friend' : 'friends'}${pendingRequests.length > 0 ? ` · ${pendingRequests.length} requests` : ''}`}
          onPress={() => setFriendsVisible(true)}
          styles={styles}
          colors={colors}
          testID="profile-friends-row"
        />
        <SettingsRow
          icon="weather-partly-cloudy"
          label="Sky and weather"
          onPress={() => navigation.navigate('SkyWeatherSettings')}
          styles={styles}
          colors={colors}
          testID="profile-sky-weather-row"
        />
        <SettingsRow
          icon="office-building-outline"
          label="Skyline"
          sublabel={`Finished towers: ${showFinishedTowers ? 'Shown' : 'Hidden'}`}
          onPress={() => navigation.navigate('SkylineSettings')}
          styles={styles}
          colors={colors}
          testID="profile-skyline-row"
        />
        <SettingsRow
          icon="gesture-tap"
          label="Accessibility"
          sublabel={`Tap to build: ${tapToBuild ? 'On' : 'Off'}`}
          onPress={() => navigation.navigate('Accessibility')}
          styles={styles}
          colors={colors}
        />
        <SettingsRow
          icon="bell-outline"
          label="Notifications"
          sublabel="Reminders and weekly recap"
          onPress={() => navigation.navigate('NotificationSettings')}
          styles={styles}
          colors={colors}
        />
        <SettingsRow
          icon="lock-outline"
          label="Privacy"
          sublabel={`Profile visibility: ${profileVisibility === 'PUBLIC' ? 'Public' : 'Private'}`}
          onPress={() => navigation.navigate('Privacy')}
          styles={styles}
          colors={colors}
        />
        <SettingsRow
          icon="cog-outline"
          label="Account"
          onPress={() => navigation.navigate('AccountSettings')}
          styles={styles}
          colors={colors}
        />

        <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
          <MaterialCommunityIcons name="logout" size={16} color={colors.atRisk} />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>

      <EditProfileModal visible={editVisible} onClose={() => setEditVisible(false)} />
      <MyStatsModal visible={myStatsVisible} onClose={() => setMyStatsVisible(false)} />
      <ShareSheet visible={shareSheetVisible} onClose={() => setShareSheetVisible(false)} habit={null} />
      <PaywallSheet
        visible={paywallVisible}
        cap="browse"
        counts={capCounts}
        onClose={() => setPaywallVisible(false)}
        onUnlocked={() => setPaywallVisible(false)}
      />
      <AddFriendModal visible={friendsVisible} onClose={() => setFriendsVisible(false)} />
      <ConfirmModal request={request} onRespond={respond} />
      <Toast toast={toast} onHide={hideToast} />
    </SafeAreaView>
  );
}

function StatChip({ value, label, styles }) {
  return (
    <View style={styles.statChip}>
      <Text style={styles.statChipValue}>{value}</Text>
      <Text style={styles.statChipLabel}>{label}</Text>
    </View>
  );
}

function SettingsRow({ icon, label, sublabel, onPress, styles, colors, testID, amber }) {
  return (
    <Pressable
      style={[styles.settingsRow, amber ? styles.settingsRowAmber : null]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <View style={[styles.settingsRowIcon, amber ? styles.settingsRowIconAmber : null]}>
        <MaterialCommunityIcons name={icon} size={18} color={amber ? colors.warning : colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={amber ? styles.settingsRowLabelAmber : styles.settingsRowLabel}>{label}</Text>
        {sublabel ? <Text style={styles.settingsRowSublabel}>{sublabel}</Text> : null}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={amber ? colors.warning : colors.textMuted} />
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
      marginBottom: spacing.lg,
    },
    title: { ...typography.screenTitle },
    editBtn: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      ...shadow,
    },
    editBtnText: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary },
    identityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    identityName: { fontFamily: fonts.extraBold, fontSize: 20, color: colors.textPrimary },
    identityMeta: { ...typography.meta, marginTop: 2 },
    heroCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      ...shadow,
    },
    heroTitle: { ...typography.cardTitle, marginBottom: spacing.md },
    previewRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      height: 86,
      marginBottom: spacing.md,
    },
    previewTowerWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
    previewFlag: { marginBottom: 2 },
    previewTower: { width: '100%', borderTopLeftRadius: radii.sm, borderTopRightRadius: radii.sm },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    statChip: { alignItems: 'center', flex: 1 },
    statChipValue: { fontFamily: fonts.extraBold, fontSize: 18, color: colors.textPrimary },
    statChipLabel: { ...typography.meta, fontSize: 11, marginTop: 1 },
    planLine: { ...typography.meta, fontSize: 12, marginTop: spacing.sm },
    settingsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      marginBottom: spacing.sm,
      ...shadow,
    },
    settingsRowAmber: {
      borderWidth: 1,
      borderColor: colors.warning,
      backgroundColor: hexToRgba(colors.warning, 0.08),
    },
    settingsRowIcon: {
      width: 32,
      height: 32,
      borderRadius: radii.md,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    settingsRowIconAmber: { backgroundColor: hexToRgba(colors.warning, 0.16) },
    settingsRowLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
    settingsRowLabelAmber: { fontFamily: fonts.extraBold, fontSize: 14, color: colors.warning },
    settingsRowSublabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
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
