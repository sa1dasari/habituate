import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ProgressRing from '../components/ProgressRing';
import ConsistencyDetailModal from '../components/ConsistencyDetailModal';
import AskHabituateModal from '../components/AskHabituateModal';
import TourHighlight from '../components/TourHighlight';
import { useAppTheme } from '../hooks/useAppTheme';
import { useHabits } from '../hooks/useHabits';
import { useRegisterScrollToTop } from '../hooks/useRegisterScrollToTop';
import { useOnboardingTour } from '../hooks/useOnboardingTour';
import { useTourTarget } from '../hooks/useTourTarget';
import { TOUR_SCOPES, TOUR_TARGETS } from '../constants/onboardingTour';
import {
  CONSISTENCY_PERIODS,
  computeConsistency,
  consistencyMessage,
  generateCoachStarterQuestions,
  isCurrentPeriod,
  periodRangeLabel,
  shiftAnchor,
} from '../utils/consistency';
import { fonts, radii, shadow, spacing } from '../theme';

const PERIOD_LABELS = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
const LIVE_PERIOD_LABELS = { daily: 'Today', weekly: 'This week', monthly: 'This month', yearly: 'This year' };
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
export default function InsightsScreen({ navigation, route }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const insets = useSafeAreaInsets();
  const scrollRef = useRegisterScrollToTop('Insights');

  const { habits, refresh } = useHabits();
  const [period, setPeriod] = useState('weekly');
  // The date each period's trailing window ends at — "now" shows the live
  // period; prev/next slide it back/forward a whole window-length at a time
  // (see utils/consistency.js's shiftAnchor), which is what lets this one
  // state value drive weekly/monthly/yearly navigation without a new
  // backend endpoint — computeConsistency/habitPeriodHistory already derive
  // every stat from the full check-in history already loaded client-side.
  const [anchor, setAnchor] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [coachVisible, setCoachVisible] = useState(false);
  const [coachInitialQuestion, setCoachInitialQuestion] = useState(null);

  const { active: tourActive, currentStep: tourStep } = useOnboardingTour();
  const tourConsistencyCardRef = useTourTarget(TOUR_TARGETS.INSIGHTS_CONSISTENCY_CARD);
  const tourCoachCardRef = useTourTarget(TOUR_TARGETS.INSIGHTS_COACH_CARD);

  // Real-screen tour step: opens the actual Ask Habituate chat in step with
  // the walkthrough, and closes it the moment the tour ends.
  useEffect(() => {
    if (!tourActive) {
      setCoachVisible(false);
      return;
    }
    if (tourStep?.id === 'ask-habituate-chat') {
      setCoachInitialQuestion(null);
      setCoachVisible(true);
    } else {
      setCoachVisible(false);
    }
  }, [tourActive, tourStep]);

  const consistency = useMemo(() => computeConsistency(habits, period, anchor), [habits, period, anchor]);
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
  const isLivePeriod = isCurrentPeriod(period, anchor);
  const rangeLabel = periodRangeLabel(period, anchor);

  const selectPeriod = (p) => {
    setPeriod(p);
    setAnchor(new Date()); // switching tabs always lands back on the live period
  };
  const goToPreviousPeriod = () => setAnchor((a) => shiftAnchor(period, a, -1));
  const goToNextPeriod = () => {
    if (isLivePeriod) return;
    setAnchor((a) => shiftAnchor(period, a, 1));
  };
  const goToNow = () => setAnchor(new Date());

  // Coming from Today's "Ask Habituate" teaser — open the chat directly
  // instead of landing on the Insights tab and making the user find it again.
  // Coming from a WEEKLY_SUMMARY/MONTHLY_SUMMARY/YEARLY_SUMMARY notification
  // (NotificationCenterModal.handlePress) — land directly on that period's
  // tab, anchored to approximately the date range it covers. The backend's
  // periodStart is a real calendar boundary (Monday/1st-of-month/Jan 1);
  // this trailing-window model doesn't have calendar-aligned months/years
  // (see utils/consistency.js), so the anchor used here is "periodStart's
  // own window length later," which lines up exactly for weekly and closely
  // for monthly/yearly — a documented approximation, not a bug.
  useFocusEffect(
    useCallback(() => {
      if (route.params?.openCoach) {
        setCoachInitialQuestion(null);
        setCoachVisible(true);
        navigation.setParams({ openCoach: undefined });
        return;
      }
      if (route.params?.periodNav) {
        const { period: navPeriod, anchorDate } = route.params.periodNav;
        if (navPeriod) {
          setPeriod(navPeriod);
          if (anchorDate) {
            const start = new Date(anchorDate);
            const approxDays = navPeriod === 'weekly' ? 7 : navPeriod === 'monthly' ? 30 : navPeriod === 'yearly' ? 365 : 1;
            const end = new Date(start);
            end.setDate(end.getDate() + approxDays - 1);
            setAnchor(end);
          } else {
            setAnchor(new Date());
          }
        }
        navigation.setParams({ periodNav: undefined });
      }
    }, [route.params?.openCoach, route.params?.periodNav, navigation])
  );

  return (
    <>
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        ref={scrollRef}
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
              onPress={() => selectPeriod(p)}
            >
              <Text style={[styles.tabText, period === p && styles.tabTextActive]}>
                {PERIOD_LABELS[p]}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.periodNavRow}>
          <Pressable
            onPress={goToPreviousPeriod}
            hitSlop={8}
            style={styles.periodNavBtn}
            accessibilityRole="button"
            accessibilityLabel={`Previous ${period} period`}
          >
            <MaterialCommunityIcons name="chevron-left" size={20} color={colors.textSecondary} />
          </Pressable>

          <Pressable onPress={goToNow} disabled={isLivePeriod} style={styles.periodRangeLabelWrap}>
            <Text style={styles.periodRangeLabel}>{isLivePeriod ? LIVE_PERIOD_LABELS[period] : rangeLabel}</Text>
            {!isLivePeriod ? <Text style={styles.periodRangeSubLabel}>{rangeLabel} · tap for now</Text> : null}
          </Pressable>

          <Pressable
            onPress={goToNextPeriod}
            disabled={isLivePeriod}
            hitSlop={8}
            style={styles.periodNavBtn}
            accessibilityRole="button"
            accessibilityLabel={`Next ${period} period`}
          >
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={isLivePeriod ? colors.textMuted : colors.textSecondary}
            />
          </Pressable>
        </View>

        <Pressable
          ref={tourConsistencyCardRef}
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

        <View style={styles.coachCard} ref={tourCoachCardRef}>
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
              <MaterialCommunityIcons name="chat-processing-outline" size={18} color={colors.accent} />
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
        anchor={anchor}
        onClose={() => setDetailVisible(false)}
      />

      <AskHabituateModal
        visible={coachVisible}
        habits={habits}
        initialQuestion={coachInitialQuestion}
        onClose={() => setCoachVisible(false)}
      />
    </SafeAreaView>
    <TourHighlight scope={TOUR_SCOPES.INSIGHTS} />
    </>
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
    periodNavRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    periodNavBtn: {
      width: 32,
      height: 32,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    periodRangeLabelWrap: { alignItems: 'center', minWidth: 140 },
    periodRangeLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
    periodRangeSubLabel: { ...typography.meta, marginTop: 1 },
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
    // Dedicated to the coach specifically — colors.accent/accentSoft, not the
    // colors.safe/safeSoft streak-safety pair the rest of this screen uses,
    // so Ask Habituate doesn't visually borrow a meaning that belongs to
    // streak state elsewhere in the app.
    coachIcon: {
      width: 36,
      height: 36,
      borderRadius: radii.md,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    coachTitle: { fontFamily: fonts.extraBold, fontSize: 16, color: colors.textPrimary },
    coachSubtitle: { ...typography.meta, marginTop: 2 },
    coachSectionLabel: {
      fontFamily: fonts.bold,
      fontSize: 12,
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
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    coachQuestionNumberText: { fontFamily: fonts.bold, fontSize: 11, color: colors.accent },
    coachQuestionText: { fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary, flex: 1 },
  });
}
