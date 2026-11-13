import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import HabitCard from '../components/HabitCard';
import FeaturedTargetsSummaryCard from '../components/FeaturedTargetsSummaryCard';
import AvatarImage from '../components/AvatarImage';
import TemplateHabitsPicker from '../components/TemplateHabitsPicker';
import AskHabituateModal from '../components/AskHabituateModal';
import TourHighlight from '../components/TourHighlight';
import Toast from '../components/Toast';
import TowerForm from '../components/TowerForm';
import ProtectionInfoModal from '../components/ProtectionInfoModal';
import { useToast } from '../hooks/useToast';
import { TOUR_SCOPES, TOUR_TARGETS } from '../constants/onboardingTour';
import { useAuth } from '../hooks/useAuth';
import { useCelebration } from '../hooks/useCelebration';
import { useOnboardingTour } from '../hooks/useOnboardingTour';
import { useTourTarget } from '../hooks/useTourTarget';
import { useRegisterScrollToTop } from '../hooks/useRegisterScrollToTop';
import { useFeaturedGoalReviews } from '../hooks/useFeaturedGoalReviews';
import { summarizeHabits, useHabits } from '../hooks/useHabits';
import {
  buildAllDoneCelebration,
  buildCheckInCelebration,
  buildHabitMilestone,
  buildStreakMilestone,
} from '../utils/celebration';
import { effectiveMonthlyTarget, effectiveWeeklyTarget } from '../utils/cadence';
import { daysLeftInMonth, daysLeftInWeek } from '../utils/date';
import { byScheduledTime } from '../utils/time';
import { useAppTheme } from '../hooks/useAppTheme';
import {
  buildCategoryTowerColors,
  fonts,
  gradients,
  radii,
  shadow,
  shadowLg,
  skylineTowerTheme,
  skylineUI,
  spacing,
} from '../theme';
import { HABIT_CATEGORY_COLORS } from '../constants/habitCategories';

// Same derivation SkylineScreen.js uses, so TowerForm's live preview renders
// identically whether opened from here or from the Skyline tab.
const towerColorsByMode = buildCategoryTowerColors(HABIT_CATEGORY_COLORS);

// Shown below the daily list so a weekly habit can still be logged from Today
// without being counted against today's progress.
const OTHER_CADENCES = [
  { key: 'weekly', title: 'This Week', note: 'Open any day this week — log one when it fits.' },
  { key: 'monthly', title: 'This Month', note: 'Open any day this month. No rush.' },
];

function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 18) return 'Good afternoon,';
  return 'Good evening,';
}

function encouragement({ total, done }, hasOtherHabits = false) {
  if (total === 0) {
    return hasOtherHabits
      ? 'Nothing due today — your weekly and monthly habits are below.'
      : 'Add your first habit below to get started.';
  }
  if (done === 0) return 'Nothing logged yet — any one of these is a fine place to start.';
  if (done === total) return 'Everything for today is logged. Nice.';

  const left = total - done;
  return left === 1
    ? "You're doing great! Just one more habit to go."
    : `You're doing great! ${left} more habits to go.`;
}

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, typography, effectiveMode } = useAppTheme();
  const towerFormTheme = skylineUI[effectiveMode];
  const towerFormTowerTheme = skylineTowerTheme[effectiveMode];
  const towerFormCategoryColors = towerColorsByMode[effectiveMode];
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const scrollRef = useRegisterScrollToTop('Today');
  const cardRefsRef = useRef({});
  const [highlightedId, setHighlightedId] = useState(null);
  const {
    habits,
    loading,
    busy,
    error,
    refresh,
    createHabit,
    toggleCheckIn,
    addCheckIn,
    removeLastCheckIn,
    toggleShield,
    repairStreak,
    shieldsAvailable,
  } = useHabits();
  const { user } = useAuth();
  const displayName = user?.displayName || 'there';
  const { celebrate: showCelebration } = useCelebration();
  const [expandedId, setExpandedId] = useState(null);
  const { toast, showToast, hideToast } = useToast();
  const [coachVisible, setCoachVisible] = useState(false);
  const [coachInitialQuestion, setCoachInitialQuestion] = useState(null);

  const { active: tourActive, currentStep: tourStep } = useOnboardingTour();
  const tourCoachButtonRef = useTourTarget(TOUR_TARGETS.TODAY_COACH_BUTTON);
  const tourAddHabitButtonRef = useTourTarget(TOUR_TARGETS.TODAY_ADD_HABIT_BUTTON);
  const tourShieldIconRef = useTourTarget(TOUR_TARGETS.TODAY_SHIELD_ICON);
  const [towerFormVisible, setTowerFormVisible] = useState(false);
  const [showShieldInfo, setShowShieldInfo] = useState(false);

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

  // Same real-screen pattern, formerly on HabitsScreen.js: opens the actual
  // create-tower form / Shield Days info modal in step with the walkthrough.
  useEffect(() => {
    if (!tourActive) {
      setTowerFormVisible(false);
      setShowShieldInfo(false);
      return;
    }
    setTowerFormVisible(tourStep?.id === 'habits-create-form');
    setShowShieldInfo(tourStep?.id === 'shield-days-info');
  }, [tourActive, tourStep]);

  const featuredHabits = useMemo(() => habits.filter((h) => h.featuredGoal), [habits]);
  const { reviews: habitGoalReviews } = useFeaturedGoalReviews(featuredHabits);

  // Featured-habit targets only — the freeform Goals feature was removed
  // (owner decision, 2026-11-13); this used to also fold in goals.map(...)
  // here, reported through the same summary card regardless of which kind
  // it was. `percent` carries actual partial progress (not just done/not-done)
  // so the summary bar reflects trend rather than looking empty until
  // something hits 100%.
  const goalItems = useMemo(
    () =>
      featuredHabits.map((h) => ({
        id: `habit-${h.id}`,
        complete: h.periodComplete,
        percent: h.periodTarget > 0 ? Math.min(100, Math.round((h.periodDone / h.periodTarget) * 100)) : 0,
        needsReview: habitGoalReviews.some((r) => r.habit.id === h.id),
      })),
    [featuredHabits, habitGoalReviews]
  );

  // "Due Today" is only genuinely daily habits (habit.dueToday, from
  // isDueToday in cadence.js). A habit whose target lives at the weekly or
  // monthly scale — gym 2x/week, 50 applications/month — is never pulled in
  // here just because slack is running low: it can happen on any day of its
  // period, so it always lives in its own section below with its own period
  // progress, and never inflates Today's Progress.
  const groups = useMemo(() => {
    const due = [];
    const weekly = [];
    const monthly = [];

    habits.forEach((habit) => {
      if (habit.dueToday) {
        due.push(habit);
      } else if (effectiveMonthlyTarget(habit) > 0 && effectiveWeeklyTarget(habit) === 0) {
        // Monthly-only target
        monthly.push(habit);
      } else if (effectiveWeeklyTarget(habit) > 0 || effectiveMonthlyTarget(habit) > 0) {
        // Has a weekly target (or both weekly+monthly)
        weekly.push(habit);
      } else {
        // Pure daily habit that's already met today's target
        due.push(habit);
      }
    });

    [due, weekly, monthly].forEach((list) => list.sort(byScheduledTime));
    return { due, weekly, monthly };
  }, [habits]);

  // "Today's Progress" only counts habits actually due today.
  const summary = useMemo(() => summarizeHabits(groups.due), [groups]);

  // Progress bar eases to its new width instead of snapping — a completed
  // check-in should feel like it landed, not just update a number. Badge
  // gets a small spring settle the moment the list goes from incomplete to
  // fully done. Both are gated on a shared "baseline" ref: habits loads
  // async, so the very first time this effect sees real data (summary.total
  // goes from its initial 0 to a real count) is just the list arriving, not
  // anything the user just did — without this guard, reopening the app on a
  // day already fully logged would sweep the bar in and pop the badge as if
  // the user had just that moment finished, celebrating stale state. The
  // first real read sets both values directly (no animation) and marks the
  // baseline; only genuine changes after that animate.
  const progressWidth = useSharedValue(summary.percent);
  const progressFillStyle = useAnimatedStyle(() => ({ width: `${progressWidth.value}%` }));

  const badgeScale = useSharedValue(1);
  const wasCompleteRef = useRef(false);
  const hasBaselineRef = useRef(false);
  useEffect(() => {
    if (!hasBaselineRef.current) {
      if (summary.total === 0) return;
      progressWidth.value = summary.percent;
      wasCompleteRef.current = summary.total > 0 && summary.done >= summary.total;
      hasBaselineRef.current = true;
      return;
    }

    progressWidth.value = withTiming(summary.percent, { duration: 450 });

    const isComplete = summary.total > 0 && summary.done >= summary.total;
    if (isComplete && !wasCompleteRef.current) {
      // Understated, matching the app's own voice ("Logged.", "Good rep.")
      // rather than a showy bounce — a small, well-damped settle, not a pop.
      badgeScale.value = withSequence(withSpring(1.12, { damping: 14 }), withSpring(1));
    }
    wasCompleteRef.current = isComplete;
  }, [summary.done, summary.total, summary.percent]);
  const badgeAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: badgeScale.value }] }));

  // Reached from a habit-reminder notification tap (NotificationCenterModal,
  // and the real OS push listener, App.js's PushNotificationTapBridge) —
  // navigateToTab('Today', { highlightHabitId }). Scrolls to that habit's
  // card and rings it (cardShellHighlighted, accent not red) for a few
  // seconds so the user can actually find what the reminder was about,
  // instead of landing on an undifferentiated list.
  //
  // Split into two effects on purpose. The param needs clearing right away
  // (InsightsScreen's openHabitId does the same) so re-focusing this screen
  // later doesn't replay it — but this effect's own setParams call flips its
  // OWN dependency back to undefined, and a single effect keyed on that
  // param would have its cleanup run as part of React's normal
  // cleanup-before-next-invocation lifecycle the instant that happens,
  // killing the retry loop and the auto-clear timer before either got to
  // finish (confirmed: the highlight never cleared, and the first scroll
  // attempt's own callback found `cancelled` already true by the time the
  // native measurement returned). Capturing the id into our own state here,
  // and running the actual work off THAT state below, means clearing the
  // nav param no longer tears down work we started because of it.
  const [pendingHighlightHabitId, setPendingHighlightHabitId] = useState(null);
  useEffect(() => {
    const incoming = route.params?.highlightHabitId;
    if (incoming == null) return;
    navigation.setParams({ highlightHabitId: undefined });
    setPendingHighlightHabitId(incoming);
  }, [route.params?.highlightHabitId, navigation]);

  // measureLayout against the ScrollView's own node (not measureInWindow)
  // gives a scroll-content-relative y directly, no manual scroll-offset
  // bookkeeping needed.
  useEffect(() => {
    const habitId = pendingHighlightHabitId;
    if (habitId == null) return undefined;
    setHighlightedId(habitId);

    let cancelled = false;
    let attempts = 0;
    let timer = null;

    const tryScroll = () => {
      if (cancelled) return;
      const cardNode = cardRefsRef.current[habitId];
      const scrollNode = scrollRef.current;
      // scrollRef.current is ScrollView's own composite wrapper (it's what
      // exposes .scrollTo below) — NOT a host element itself, so Fabric's
      // measureLayout rejects it (and rejects a plain findNodeHandle()
      // number too: it now requires `instanceof ReactNativeElement`, a real
      // ref to a native component, see ReactNativeElement.js's
      // measureLayout). getNativeScrollRef() is ScrollView's own accessor
      // for that actual underlying host node.
      const scrollHostNode = scrollNode && scrollNode.getNativeScrollRef();
      if (cardNode && scrollHostNode) {
        cardNode.measureLayout(
          scrollHostNode,
          (x, y) => {
            if (!cancelled) scrollNode.scrollTo({ y: Math.max(0, y - spacing.lg), animated: true });
          },
          () => {}
        );
        return;
      }
      attempts += 1;
      // Covers the habits list still loading/laying out (e.g. a cold start
      // from the real OS push, not just the in-app notification center).
      if (attempts < 20) timer = setTimeout(tryScroll, 150);
    };
    tryScroll();

    const clearTimer = setTimeout(() => {
      setHighlightedId((current) => (current === habitId ? null : current));
      setPendingHighlightHabitId((current) => (current === habitId ? null : current));
    }, 2800);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      clearTimeout(clearTimer);
    };
  }, [pendingHighlightHabitId]);

  // Logging progress is the only action that gets a celebration; undoing stays
  // silent. Priority when more than one applies on the same check-in: a
  // streak crossing a multiple of 7 (the same threshold that earns a
  // Shield), THEN a habit's own weekly/monthly target being met, then
  // finishing every habit due today, then the routine card — showing more
  // than one at once would be excessive. Streak milestone goes first: for
  // an untargeted daily habit (the common case), buildHabitMilestone's own
  // "target met" fires on literally every first check-in of the day
  // (periodTarget defaults to 1 with nothing set), which would otherwise
  // permanently shadow the streak milestone for exactly the habit type
  // whose daily streaks are the whole point. The routine card only shows
  // on the FIRST check-in of the day for a habit — a count-mode habit
  // tapped 5 times for 5 applications shouldn't pop up 5 times, though a
  // milestone crossed on tap 3 still always shows.
  const celebrate = useCallback(
    (habit, delta = 1) => {
      const previousDone = summary.done;
      const todayDone = habit.dueToday ? Math.min(summary.total, previousDone + delta) : previousDone;

      const payload =
        buildStreakMilestone(habit, { shieldsAvailable }) ||
        buildHabitMilestone(habit, delta, { todayDone, todayTotal: summary.total }) ||
        buildAllDoneCelebration(previousDone, todayDone, summary.total) ||
        (habit.checkedInToday
          ? null
          : buildCheckInCelebration(habit, delta, { todayDone, todayTotal: summary.total }));
      if (payload) {
        // A milestone/all-done moment is a bigger deal than a plain check-in tap, so it
        // gets the stronger "success" haptic rather than the light tap below.
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        showCelebration(payload);
      }
    },
    [summary, showCelebration, shieldsAvailable]
  );

  const handleToggle = useCallback(
    async (habit) => {
      const wasChecked = habit.checkedInToday;
      try {
        await toggleCheckIn(habit.id);
      } catch (err) {
        showToast(`Could not update check-in — ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (!wasChecked) celebrate(habit, 1);
    },
    [toggleCheckIn, celebrate]
  );

  // Deactivating is always just an API call (frees a shield back up). Activating
  // needs a shield actually banked first — if none are, don't fail the request,
  // open the Shield Days info modal directly to see how to earn one.
  const handleToggleShield = useCallback(
    async (habit) => {
      if (!habit.shieldedToday && shieldsAvailable <= 0) {
        setShowShieldInfo(true);
        return;
      }
      try {
        await toggleShield(habit.id);
      } catch (err) {
        showToast(`Couldn't update shield — ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    },
    [toggleShield, shieldsAvailable]
  );

  // Server validates the real eligibility (48h window, once/habit/month) --
  // HabitCard's zero-streak guard is only a coarse pre-filter, so this
  // commonly fails with a specific reason, not just succeeds.
  const handleRepairStreak = useCallback(
    async (habit) => {
      try {
        await repairStreak(habit.id);
      } catch (err) {
        showToast(`Couldn't repair streak — ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast('Streak restored', 'success');
    },
    [repairStreak]
  );

  const handleAdd = useCallback(
    async (habit) => {
      try {
        await addCheckIn(habit.id);
      } catch (err) {
        showToast(`Could not log check-in — ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      celebrate(habit, 1);
    },
    [addCheckIn, celebrate]
  );

  const handleLogAmount = useCallback(
    async (habit, amount) => {
      try {
        await addCheckIn(habit.id, amount);
      } catch (err) {
        showToast(`Could not log progress — ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      celebrate(habit, amount);
    },
    [addCheckIn, celebrate]
  );

  // A first-time user's fastest path to a real habit — sensible defaults
  // (once-a-day tracking, no targets/reminder) instead of the full create
  // form. The habits list refreshes itself (useHabits' createHabit already
  // triggers a refetch), so the new habit just appears in "Due Today" below.
  const handleAddTemplateHabit = useCallback(
    async (template) => {
      try {
        await createHabit({
          name: template.name,
          category: template.category,
          cadenceType: 'DAILY',
          cadenceTarget: 1,
          weeklyTarget: null,
          monthlyTarget: null,
          trackingMode: 'BOOLEAN',
          featuredGoal: false,
          scheduledTime: '',
          reminderEnabled: false,
        });
      } catch (err) {
        showToast(`Could not add habit — ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      }
    },
    [createHabit]
  );

  const handleRemoveLast = useCallback(
    async (habitId) => {
      try {
        await removeLastCheckIn(habitId);
      } catch (err) {
        showToast(`Could not undo check-in — ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    },
    [removeLastCheckIn]
  );

  // A habit with both a weekly and a monthly target still has only one bar
  // on its card — it needs to reflect whichever scale this section is about,
  // not always the "primary" (monthly-first) number cadenceProgress picks.
  // Otherwise a card sitting under "This Week" can show 20% from the monthly
  // count even though the week's own target was just fully met.
  const focusedProgress = (habit, focus) => {
    if (focus === 'weekly') {
      const target = habit.weeklyTarget || 0;
      return {
        periodDone: habit.weeklyDone || 0,
        periodTarget: target,
        periodNoun: 'this week',
        periodComplete: target > 0 && (habit.weeklyDone || 0) >= target,
        daysLeft: daysLeftInWeek(),
      };
    }
    if (focus === 'monthly') {
      const target = habit.monthlyTarget || 0;
      return {
        periodDone: habit.monthlyDone || 0,
        periodTarget: target,
        periodNoun: 'this month',
        periodComplete: target > 0 && (habit.monthlyDone || 0) >= target,
        daysLeft: daysLeftInMonth(),
      };
    }
    return {
      periodDone: habit.periodDone,
      periodTarget: habit.periodTarget,
      periodNoun: habit.periodNoun,
      periodComplete: habit.periodComplete,
      daysLeft: habit.daysLeftInPeriod,
    };
  };

  const renderHabit = (habit, focus = 'daily') => {
    const progress = focusedProgress(habit, focus);
    return (
      <View
        key={habit.id}
        collapsable={false}
        ref={(el) => {
          if (el) cardRefsRef.current[habit.id] = el;
          else delete cardRefsRef.current[habit.id];
        }}
      >
      <HabitCard
        variant="today"
        highlighted={highlightedId === habit.id}
        name={habit.name}
        category={habit.category}
        cadenceType={habit.cadenceType}
        trackingMode={habit.trackingMode}
        todayCount={habit.todayCount}
        scheduledTime={habit.scheduledTime}
        progressLabel={habit.progressLabel}
        progressComplete={progress.periodComplete}
        periodDone={progress.periodDone}
        periodTarget={progress.periodTarget}
        periodNoun={progress.periodNoun}
        daysLeft={progress.daysLeft}
        checkIns={habit.checkIns}
        expanded={expandedId === habit.id}
        checked={habit.checkedInToday}
        streak={habit.streak}
        streakStatus={habit.streakStatus}
        shieldedToday={habit.shieldedToday}
        shieldEligible={habit.shieldEligible}
        disabled={busy}
        onPress={() => setExpandedId((current) => (current === habit.id ? null : habit.id))}
        onToggle={() => handleToggle(habit)}
        onToggleShield={() => handleToggleShield(habit)}
        onRepairStreak={() => handleRepairStreak(habit)}
        onAdd={() => handleAdd(habit)}
        onRemoveLast={() => handleRemoveLast(habit.id)}
        onLogAmount={(amount) => handleLogAmount(habit, amount)}
      />
      </View>
    );
  };

  return (
    <>
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.container, { paddingBottom: spacing.xl + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.name}>{displayName}</Text>
          </View>

          {shieldsAvailable > 0 || (tourActive && tourStep?.id === 'habits-shield') ? (
            <Pressable
              ref={tourShieldIconRef}
              style={styles.shieldBadge}
              accessibilityRole="button"
              accessibilityLabel={`${shieldsAvailable} Shield Days banked`}
              onPress={() => setShowShieldInfo(true)}
            >
              <MaterialCommunityIcons name="shield-check" size={14} color={colors.safe} />
              <Text style={styles.shieldBadgeText}>{shieldsAvailable}</Text>
            </Pressable>
          ) : null}

          <Pressable
            ref={tourCoachButtonRef}
            style={styles.coachIconBtn}
            accessibilityRole="button"
            accessibilityLabel="Open AI coach chat"
            onPress={() => {
              setCoachInitialQuestion(null);
              setCoachVisible(true);
            }}
          >
            <MaterialCommunityIcons name="chat-processing-outline" size={20} color={colors.accent} />
          </Pressable>

          <Pressable
            style={styles.avatar}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={() => navigation.navigate('Profile')}
          >
            <AvatarImage uri={user?.photoURL} name={displayName} size={48} style={styles.avatarPhoto} />
          </Pressable>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View style={styles.summaryText}>
              <Text style={styles.summaryLabel}>Today's Progress</Text>
              <Text style={styles.summaryCount}>
                {summary.done}/{summary.total}
              </Text>
            </View>

            <Animated.View style={[styles.summaryBadge, badgeAnimatedStyle]}>
              <MaterialCommunityIcons
                name="check-circle-outline"
                size={28}
                color={colors.safe}
              />
            </Animated.View>
          </View>

          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, progressFillStyle]}>
              <LinearGradient
                colors={gradients.safe}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
            </Animated.View>
          </View>

          <Text style={styles.summaryNudge}>
            {encouragement(summary, habits.length > groups.due.length)}
          </Text>
        </View>

        <FeaturedTargetsSummaryCard items={goalItems} />

        <Pressable
          style={({ pressed }) => [styles.coachTeaser, pressed ? styles.coachTeaserPressed : null]}
          accessibilityRole="button"
          accessibilityLabel="Ask Habituate"
          onPress={() => {
            setCoachInitialQuestion(null);
            setCoachVisible(true);
          }}
        >
          <MaterialCommunityIcons name="chat-processing-outline" size={18} color={colors.accent} />
          <Text style={styles.coachTeaserText}>Ask Habituate anything about your progress</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} />
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Due Today</Text>
        </View>

        {/* Replaying the tour (Account Settings → "Replay tour") can land here
            with habits already on the account — 'habits-intro' still needs a
            real button to spotlight, so render just the CTA standalone rather
            than the whole empty-state illustration below. */}
        {tourActive && tourStep?.id === 'habits-intro' && habits.length > 0 ? (
          <Pressable
            ref={tourAddHabitButtonRef}
            style={styles.emptyCta}
            accessibilityRole="button"
            accessibilityLabel="Add your first habit"
            onPress={() => setTowerFormVisible(true)}
          >
            <Text style={styles.emptyCtaText}>Add your first habit</Text>
            <MaterialCommunityIcons name="arrow-right" size={16} color={colors.accent} />
          </Pressable>
        ) : null}

        {loading && habits.length === 0 ? (
          <View style={styles.loaderRow}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.loaderText}>Loading habits…</Text>
          </View>
        ) : habits.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nothing to track yet</Text>
            <Text style={styles.emptyBody}>
              Tap one below to start, or build your own.
            </Text>
            <TemplateHabitsPicker onSelect={handleAddTemplateHabit} disabled={busy} />
            <Pressable
              ref={tourAddHabitButtonRef}
              style={styles.emptyCta}
              accessibilityRole="button"
              accessibilityLabel="Add your first habit"
              onPress={() => setTowerFormVisible(true)}
            >
              <Text style={styles.emptyCtaText}>Add your first habit</Text>
              <MaterialCommunityIcons name="arrow-right" size={16} color={colors.accent} />
            </Pressable>
          </View>
        ) : groups.due.length === 0 ? (
          <Text style={styles.sectionNote}>
            Nothing has to happen today — your weekly and monthly habits are below.
          </Text>
        ) : (
          groups.due.map((habit) => renderHabit(habit, 'daily'))
        )}

        {OTHER_CADENCES.map(({ key, title, note }) =>
          groups[key].length > 0 ? (
            <View key={key} style={styles.laterSection}>
              <Text style={styles.sectionTitle}>{title}</Text>
              <Text style={styles.sectionNote}>{note}</Text>
              {groups[key].map((habit) => renderHabit(habit, key))}
            </View>
          ) : null
        )}
      </ScrollView>
    </SafeAreaView>

    <AskHabituateModal
      visible={coachVisible}
      habits={habits}
      initialQuestion={coachInitialQuestion}
      onClose={() => setCoachVisible(false)}
    />

    <TowerForm
      key="new"
      visible={towerFormVisible}
      onClose={() => setTowerFormVisible(false)}
      habit={null}
      theme={towerFormTheme}
      towerTheme={towerFormTowerTheme}
      categoryColors={towerFormCategoryColors}
    />

    <ProtectionInfoModal
      visible={showShieldInfo}
      initialTab="shield"
      onClose={() => setShowShieldInfo(false)}
    />

    <TourHighlight scope={TOUR_SCOPES.TODAY} />
    <Toast toast={toast} onHide={hideToast} />
    </>
  );
}

function makeStyles(colors, typography) {
  return StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  headerText: { flex: 1 },
  greeting: { ...typography.body, color: colors.textSecondary },
  shieldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.safeSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    marginRight: spacing.sm,
  },
  shieldBadgeText: { fontFamily: fonts.extraBold, fontSize: 12, color: colors.safe },
  name: { ...typography.screenTitle, marginTop: 2 },
  coachIconBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    marginRight: spacing.sm,
  },
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
  avatarText: { ...typography.cardTitle, color: colors.accent },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    ...shadowLg,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  summaryText: { flex: 1 },
  summaryLabel: { ...typography.body, color: colors.textSecondary },
  summaryCount: {
    fontFamily: fonts.extraBold,
    fontSize: 34,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  summaryBadge: {
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.safeSoft,
  },
  progressTrack: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.ringTrack,
    overflow: 'hidden',
    marginTop: spacing.lg,
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.pill,
    // The gradient now fills this View (absoluteFillObject) instead of
    // carrying its own rounded corners directly — without clipping here,
    // the fill's trailing edge at partial width is square, not rounded.
    overflow: 'hidden',
  },
  summaryNudge: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: { ...typography.sectionTitle, fontSize: 18 },
  seeAll: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.accent },
  laterSection: { marginTop: spacing.lg },
  sectionNote: { ...typography.meta, marginBottom: spacing.md },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  loaderText: { ...typography.body, color: colors.textSecondary },
  error: { fontFamily: fonts.regular, color: colors.atRisk, fontSize: 13, marginBottom: spacing.md },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadow,
  },
  emptyTitle: { ...typography.cardTitle, marginBottom: spacing.sm },
  emptyBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  emptyCtaText: { ...typography.label, color: colors.accent },
  coachTeaser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.xl,
  },
  coachTeaserPressed: { opacity: 0.8 },
  coachTeaserText: { ...typography.label, color: colors.textPrimary, flex: 1 },
  });
}
