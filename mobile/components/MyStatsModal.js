import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AvatarImage from './AvatarImage';
import FlameIcon from './FlameIcon';
import Toast from './Toast';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import api from '../api/client';
import { navigateToTab } from '../utils/navigationRef';
import { gradients, radii, shadow, shadowLg, spacing } from '../theme';

function buildShareMessage(stats, firstName) {
  const bits = [`🔥 ${stats.bestCurrentStreak}-day streak`];
  if (stats.bestLongestStreak > stats.bestCurrentStreak) {
    bits.push(`🏆 ${stats.bestLongestStreak}-day best ever`);
  }
  bits.push(`📊 ${stats.consistencyPercent30d}% consistent this month`);
  return `${firstName ? `${firstName} is` : "I'm"} building better habits with Habituate — ${bits.join(' · ')}.`;
}

/**
 * Opened by tapping Profile's own "Hi {name}, you're doing great" hero card —
 * the same aggregate-stats shape FriendProfileModal shows for a friend's
 * PUBLIC profile (best streak, longest streak, active habits, consistency),
 * just for yourself. Deliberately not gated by your own profileVisibility
 * setting — that controls what OTHERS see about you, not what you see about
 * your own account — and skips FriendProfileModal's visibility badge and
 * "shared with you" section, which don't apply when the viewer and the
 * subject are the same person.
 */
export default function MyStatsModal({ visible, onClose }) {
  const { colors, typography } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { user } = useAuth();

  const { toast, showToast, hideToast } = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const goTo = (tab) => {
    onClose();
    navigateToTab(tab);
  };

  const handleShare = async () => {
    if (!stats) return;
    const firstName = (user?.displayName || '').split(' ')[0];
    try {
      await Share.share({ message: buildShareMessage(stats, firstName) });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't share — try again.", 'error');
    }
  };

  useEffect(() => {
    if (!visible) {
      setStats(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getMyStats()
      .then((data) => {
        if (!cancelled) setStats(data);
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
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            My Stats
          </Text>
          <Pressable
            onPress={handleShare}
            hitSlop={12}
            style={styles.closeBtn}
            disabled={!stats}
            accessibilityRole="button"
            accessibilityLabel="Share my stats"
          >
            <MaterialCommunityIcons
              name="share-variant-outline"
              size={20}
              color={stats ? colors.accent : colors.textMuted}
            />
          </Pressable>
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
        ) : stats ? (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.heroCard}>
              <View style={styles.avatarLg}>
                <AvatarImage uri={user?.photoURL} name={user?.displayName} size={64} fontSize={22} />
              </View>
              <Text style={styles.heroName}>{user?.displayName || 'You'}</Text>
            </View>

            <View style={styles.statsCard}>
              <Text style={styles.sectionTitle}>Overview</Text>
              <View style={styles.statsGrid}>
                <StatTile
                  styles={styles}
                  colors={colors}
                  icon={<FlameIcon width={20} height={20} streak={stats.bestCurrentStreak} />}
                  label="Best current streak"
                  value={`${stats.bestCurrentStreak}d`}
                />
                <StatTile
                  styles={styles}
                  colors={colors}
                  icon={<MaterialCommunityIcons name="trophy-outline" size={20} color={colors.accent} />}
                  label="Longest streak"
                  value={`${stats.bestLongestStreak}d`}
                />
                <StatTile
                  styles={styles}
                  colors={colors}
                  icon={<MaterialCommunityIcons name="target" size={20} color={colors.accent} />}
                  label="Active habits"
                  value={String(stats.activeHabitCount)}
                  onPress={() => goTo('Habits')}
                  actionHint="View all habits"
                />
                <StatTile
                  styles={styles}
                  colors={colors}
                  icon={<MaterialCommunityIcons name="calendar-check-outline" size={20} color={colors.accent} />}
                  label="Member since"
                  value={stats.memberSince || '—'}
                />
              </View>

              <Text style={styles.consistencyLabel}>
                {stats.consistencyPercent30d}% consistency · last 30 days (all habits)
              </Text>
              <View style={styles.progressTrack}>
                <LinearGradient
                  colors={gradients.accent}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: `${Math.max(4, Math.min(100, stats.consistencyPercent30d))}%` }]}
                />
              </View>
            </View>
          </ScrollView>
        ) : null}
        <Toast toast={toast} onHide={hideToast} />
      </SafeAreaView>
    </Modal>
  );
}

/** Tiles with an onPress become real buttons (e.g. "Active habits" jumps to the Habits
 * tab) — "Member since" has nothing reasonable to act on, so it stays a static fact. */
function StatTile({ icon, label, value, styles, colors, onPress, actionHint }) {
  const content = (
    <>
      <View style={styles.statTileTopRow}>
        {icon}
        {onPress ? <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textMuted} /> : null}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {actionHint ? <Text style={styles.statActionHint}>{actionHint}</Text> : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.statTile}>{content}</View>;
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.statTile, pressed && styles.statTilePressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}. ${actionHint}`}
    >
      {content}
    </Pressable>
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
    statsCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      ...shadow,
    },
    sectionTitle: { ...typography.sectionTitle, marginBottom: spacing.md },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
    statTile: {
      width: '47%',
      backgroundColor: colors.background,
      borderRadius: radii.md,
      padding: spacing.md,
      gap: 4,
    },
    statTilePressed: { opacity: 0.7 },
    statTileTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    statValue: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
    statLabel: { ...typography.meta },
    statActionHint: { fontSize: 11, fontWeight: '700', color: colors.accent, marginTop: 2 },
    consistencyLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
    progressTrack: {
      height: 8,
      borderRadius: radii.pill,
      backgroundColor: colors.ringTrack,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: radii.pill },
  });
}
