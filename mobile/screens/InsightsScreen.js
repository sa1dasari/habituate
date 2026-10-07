import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ProgressRing from '../components/ProgressRing';
import ConsistencyDetailModal from '../components/ConsistencyDetailModal';
import AskHabituateModal from '../components/AskHabituateModal';
import { useAppTheme } from '../hooks/useAppTheme';
import { useHabits } from '../hooks/useHabits';
import {
  CONSISTENCY_PERIODS,
  computeConsistency,
  consistencyMessage,
  generateCoachStarterQuestions,
} from '../utils/consistency';
import { radii, shadow, spacing } from '../theme';

const PERIOD_LABELS = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
const PERIOD_TITLES = {
  daily: 'DAILY CONSISTENCY',
  weekly: 'WEEKLY CONSISTENCY',
  monthly: 'MONTHLY CONSISTENCY',
  yearly: 'YEARLY CONSISTENCY',
};

/**
 * Pattern/correlation detection (Phase 5/6) was removed 2026-10-04 — real
 * usage showed it wasn't useful. This screen is the consistency ring (opens
 * a per-habit bar-graph drill-down via ConsistencyDetailModal when tapped)
 * plus the Ask Habituate AI-coach entry card (design/Insights.png), which
 * opens AskHabituateModal — SKILLS.md Phase 10's full replacement for
 * pattern detection.
 */
export default function InsightsScreen() {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const insets = useSafeAreaInsets();

  const { habits, refresh } = useHabits();
  const [period, setPeriod] = useState('weekly');
  const [refreshing, setRefreshing] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [coachVisible, setCoachVisible] = useState(false);
  const [coachInitialQuestion, setCoachInitialQuestion] = useState(null);

  const consistency = useMemo(() => computeConsistency(habits, period), [habits, period]);
  const message = useMemo(
    () => consistencyMessage(consistency.percent, consistency.hasData),
    [consistency]
  );
  const coachStarterQuestions = useMemo(() => generateCoachStarterQuestions(habits), [habits]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

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
        <Text style={styles.subtitle}>Understand your progress. Find your rhythm.</Text>

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

        <Pressable
          style={styles.consistencyCard}
          onPress={() => setDetailVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Open consistency detail"
        >
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
        </Pressable>

        <View style={styles.coachCard}>
          <Pressable
            style={styles.coachHeaderRow}
            onPress={() => {
              setCoachInitialQuestion(null);
              setCoachVisible(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Open Ask Habituate"
          >
            <View style={styles.coachIcon}>
              <MaterialCommunityIcons name="chart-bar" size={18} color={colors.safe} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.coachTitle}>Ask Habituate</Text>
              <Text style={styles.coachSubtitle}>Small steps, guided by your check-ins. Ask a question to begin.</Text>
            </View>
          </Pressable>

          <Text style={styles.coachSectionLabel}>Suggested questions</Text>
          {coachStarterQuestions.map((q, i) => (
            <Pressable
              key={q}
              style={styles.coachQuestionRow}
              onPress={() => {
                setCoachInitialQuestion(q);
                setCoachVisible(true);
              }}
            >
              <View style={styles.coachQuestionNumber}>
                <Text style={styles.coachQuestionNumberText}>{i + 1}</Text>
              </View>
              <Text style={styles.coachQuestionText}>{q}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <ConsistencyDetailModal
        visible={detailVisible}
        habits={habits}
        initialPeriod={period}
        onClose={() => setDetailVisible(false)}
      />

      <AskHabituateModal
        visible={coachVisible}
        habits={habits}
        initialQuestion={coachInitialQuestion}
        onClose={() => setCoachVisible(false)}
      />
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
    coachCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      ...shadow,
    },
    coachHeaderRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    coachIcon: {
      width: 36,
      height: 36,
      borderRadius: radii.md,
      backgroundColor: colors.safeSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    coachTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
    coachSubtitle: { ...typography.meta, marginTop: 2 },
    coachSectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      marginBottom: spacing.sm,
    },
    coachQuestionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.background,
      borderRadius: radii.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    coachQuestionNumber: {
      width: 20,
      height: 20,
      borderRadius: radii.pill,
      backgroundColor: colors.safeSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    coachQuestionNumberText: { fontSize: 11, fontWeight: '700', color: colors.safe },
    coachQuestionText: { fontSize: 13, color: colors.textPrimary, flex: 1 },
  });
}
