import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import InsightCard from '../components/InsightCard';
import ProgressRing from '../components/ProgressRing';
import { useAppTheme } from '../hooks/useAppTheme';
import { useHabits } from '../hooks/useHabits';
import { useInsights } from '../hooks/useInsights';
import { CONSISTENCY_PERIODS, computeConsistency, consistencyMessage } from '../utils/consistency';
import { radii, shadow, spacing } from '../theme';

const PERIOD_LABELS = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
const PERIOD_TITLES = {
  daily: 'DAILY CONSISTENCY',
  weekly: 'WEEKLY CONSISTENCY',
  monthly: 'MONTHLY CONSISTENCY',
  yearly: 'YEARLY CONSISTENCY',
};

export default function InsightsScreen() {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const insets = useSafeAreaInsets();

  const { habits, loading: habitsLoading } = useHabits();
  const { insights, loading: insightsLoading, busy, recompute, dismiss, refresh } = useInsights();
  const [period, setPeriod] = useState('weekly');
  const [refreshing, setRefreshing] = useState(false);

  const consistency = useMemo(() => computeConsistency(habits, period), [habits, period]);
  const message = useMemo(
    () => consistencyMessage(consistency.percent, consistency.hasData),
    [consistency]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), recompute()]);
    setRefreshing(false);
  }, [refresh, recompute]);

  const handleDismiss = useCallback(
    async (insightId) => {
      const ok = await dismiss(insightId);
      if (!ok) {
        Alert.alert('Could not dismiss', 'Something went wrong — try again.');
      }
    },
    [dismiss]
  );

  const loading = habitsLoading || insightsLoading;
  const trend = consistency.trendDelta;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: spacing.xl + insets.bottom }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        <Text style={styles.title}>Insights</Text>
        <Text style={styles.subtitle}>Behavioral patterns and evidence-based nudges.</Text>

        <View style={styles.tabRow}>
          {CONSISTENCY_PERIODS.map((p) => (
            <Pressable
              key={p}
              style={[styles.tabPill, period === p && styles.tabPillActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.tabText, period === p && styles.tabTextActive]}>
                {PERIOD_LABELS[p]}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.consistencyCard}>
          <View style={styles.consistencyHeaderRow}>
            <View>
              <Text style={styles.consistencyLabel}>{PERIOD_TITLES[period]}</Text>
              <Text style={styles.consistencyPercent}>{consistency.percent}%</Text>
            </View>
            {trend != null ? (
              <View style={[styles.trendBadge, trend < 0 && styles.trendBadgeDown]}>
                <MaterialCommunityIcons
                  name={trend >= 0 ? 'arrow-up' : 'arrow-down'}
                  size={12}
                  color={trend >= 0 ? colors.safe : colors.textSecondary}
                />
                <Text style={[styles.trendText, trend < 0 && styles.trendTextDown]}>
                  {trend >= 0 ? '+' : ''}
                  {trend}%
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.ringRow}>
            <ProgressRing
              percent={consistency.percent}
              size={120}
              strokeWidth={12}
              label={consistency.centerValue}
              caption={consistency.centerLabel}
            />
          </View>

          <Text style={styles.messageTitle}>{message.title}</Text>
          <Text style={styles.messageSubtitle}>{message.subtitle}</Text>
        </View>

        <Text style={styles.sectionTitle}>Pattern detected</Text>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={styles.loadingSpinner} />
        ) : insights.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="chart-timeline-variant" size={28} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Patterns need a little more data.</Text>
            <Text style={styles.emptyBody}>
              Keep checking in — once there's enough history, real patterns between your habits
              will show up here.
            </Text>
          </View>
        ) : (
          insights.map((insight) => (
            <View key={insight.id} style={styles.insightWrap}>
              <InsightCard
                kind={insight.type}
                habitA={insight.payload.habitAName}
                habitB={insight.payload.habitBName}
                matchPercent={insight.payload.matchPercent}
                description={insight.payload.description}
                nudge={insight.payload.nudge}
                sampleSize={insight.payload.sampleSize}
              />
              <Pressable
                style={styles.dismissButton}
                onPress={() => handleDismiss(insight.id)}
                disabled={busy}
                hitSlop={8}
              >
                <Text style={styles.dismissText}>Dismiss</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors, typography) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    container: { padding: spacing.xl },
    title: { ...typography.screenTitle },
    subtitle: {
      ...typography.meta,
      marginTop: 2,
      marginBottom: spacing.lg,
    },
    tabRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: radii.pill,
      padding: 4,
      marginBottom: spacing.lg,
    },
    tabPill: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      alignItems: 'center',
    },
    tabPillActive: {
      backgroundColor: colors.textPrimary,
    },
    tabText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    tabTextActive: {
      color: colors.background,
    },
    consistencyCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: spacing.xl,
      ...shadow,
    },
    consistencyHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    consistencyLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.5,
    },
    consistencyPercent: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.textPrimary,
      marginTop: 2,
    },
    trendBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.safeSoft,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 4,
    },
    trendBadgeDown: {
      backgroundColor: colors.neutralSoft,
    },
    trendText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.safe,
    },
    trendTextDown: {
      color: colors.textSecondary,
    },
    ringRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: spacing.lg,
    },
    messageTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    messageSubtitle: {
      ...typography.body,
      color: colors.textSecondary,
    },
    sectionTitle: {
      ...typography.sectionTitle,
      marginBottom: spacing.md,
    },
    loadingSpinner: {
      marginTop: spacing.xl,
    },
    emptyCard: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.xl,
      gap: spacing.sm,
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    emptyBody: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    insightWrap: {
      marginBottom: spacing.sm,
    },
    dismissButton: {
      alignSelf: 'flex-end',
      marginTop: -spacing.sm,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    dismissText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
  });
}
