import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHabits } from '../hooks/useHabits';
import { useAuth } from '../hooks/useAuth';
import { useAppTheme } from '../hooks/useAppTheme';
import { useTapToBuild } from '../hooks/useTapToBuild';
import { useWindowCount } from '../hooks/useWindowCount';
import { useWeatherSky } from '../hooks/useWeatherSky';
import { useToast } from '../hooks/useToast';
import Toast from '../components/Toast';
import LocationPermissionModal from '../components/LocationPermissionModal';
import AskHabituateModal from '../components/AskHabituateModal';
import TemplateHabitsPicker from '../components/TemplateHabitsPicker';
import AvatarImage from '../components/AvatarImage';
import { HABIT_CATEGORY_COLORS } from '../constants/habitCategories';
import { buildCategoryTowerColors, fonts, skyGradients, skylineTowerTheme, skylineUI } from '../theme';
import { buildScene } from '../utils/skylineScene';
import { buildLots } from '../utils/lots';
import { toSceneHabit, toLotHabit } from '../utils/skylineAdapter';
import { skyKind } from '../utils/sky';
import { effectiveMonthlyTarget, effectiveWeeklyTarget, hasDailyTarget, isCountMode, isDueToday } from '../utils/cadence';
import { useSkylineView } from '../hooks/useSkylineView';
import SkylineView from '../components/SkylineView';
import SkyBackdrop from '../components/SkyBackdrop';
import SkylineHoldLayer from '../components/SkylineHoldLayer';
import SkylineHabitSheet, { SHEET_PEEK_HEIGHT } from '../components/SkylineHabitSheet';
import LotsView from '../components/LotsView';

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/**
 * The real Skyline screen (SKYLINE.md Phase 2), wired to the existing
 * useHabits hook — unlike screens/dev/SkylineEngineScreen.js, which only
 * ever renders fixtures. Not yet registered as the live "Today"/"Skyline"
 * tab: Shield Day toggle and streak repair live in the tower sheet, which
 * is Phase 3, so renaming the tab now would lose capability versus the old
 * TodayScreen. Reachable for now via the __DEV__ tab in App.js.
 *
 * Layout matches concept_screens/1-skyline-daily.png: header (title, date +
 * built count, chat/profile icons), the sky+towers scene, then a persistent
 * bottom sheet listing every habit as a row — the full non-visual
 * equivalent of the skyline (section 13).
 */

const towerColorsByMode = buildCategoryTowerColors(HABIT_CATEGORY_COLORS);
const SKY_REFRESH_MS = 60000;

function formatHeaderDate(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function SkylineScreen({ navigation }) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { habits, loading, toggleCheckIn, addCheckIn, createHabit } = useHabits();
  const { user } = useAuth();
  const { effectiveMode } = useAppTheme();
  const { tapToBuild } = useTapToBuild();
  const { windowCount } = useWindowCount();
  const { toast, showToast, hideToast } = useToast();
  const { needsLocationPrompt, weatherCode, sunrise, sunset, requestLocation, skipLocationPrompt } =
    useWeatherSky();
  const [today, setToday] = useState(() => new Date());
  const [chatVisible, setChatVisible] = useState(false);
  const [addHabitVisible, setAddHabitVisible] = useState(false);
  const [stageHeight, setStageHeight] = useState(0);
  // Measured, not guessed — concept_screens/1-skyline-daily.png shows the
  // sun/moon clearly below the header, not behind or crowding it. A flat
  // fraction of the full window height would sit right under the header on
  // some devices and well below it on others.
  const [headerAreaHeight, setHeaderAreaHeight] = useState(0);
  const { view, setView } = useSkylineView();
  // "Asked once, after the user's first floor" (SKYLINE.md section 5) — not
  // on mount. This tracks whether a build has happened yet during this visit
  // to the screen; the actual "only once ever" guarantee is
  // needsLocationPrompt's own AsyncStorage flag.
  const [hasBuiltOnce, setHasBuiltOnce] = useState(false);

  const recomputeToday = useCallback(() => setToday(new Date()), []);

  // Day rollover / sky freshness: a session left open across midnight (or
  // backgrounded for a while) must not build against yesterday's date or
  // show a stale sky — recompute on focus, on foreground, and periodically
  // while this screen is actually the active one.
  useFocusEffect(recomputeToday);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') recomputeToday();
    });
    return () => sub.remove();
  }, [recomputeToday]);

  useEffect(() => {
    const id = setInterval(recomputeToday, SKY_REFRESH_MS);
    return () => clearInterval(id);
  }, [recomputeToday]);

  const ui = skylineUI[effectiveMode];
  const towerTheme = skylineTowerTheme[effectiveMode];
  const categoryColors = towerColorsByMode[effectiveMode];
  const currentSkyKind = skyKind({ now: today, sunrise, sunset, weatherCode });
  const skyStops = skyGradients[effectiveMode][currentSkyKind];

  // A habit lives in exactly one view: Daily (towers) if it has a daily
  // target, Weekly and monthly (lots) if its only target is at the weekly
  // or monthly scale (SKYLINE.md section 4a) — same split `isDueToday`
  // already relies on (hasDailyTarget) plus actually having a period target
  // set, so a habit with neither (shouldn't happen, but just in case)
  // doesn't silently vanish from both views.
  const towerHabits = useMemo(() => habits.filter((h) => hasDailyTarget(h)), [habits]);
  const lotHabits = useMemo(
    () => habits.filter((h) => !hasDailyTarget(h) && (effectiveWeeklyTarget(h) > 0 || effectiveMonthlyTarget(h) > 0)),
    [habits],
  );

  const sceneHabits = useMemo(
    () => towerHabits.map((h) => toSceneHabit(h, categoryColors)),
    [towerHabits, categoryColors],
  );

  const scene = useMemo(
    () => buildScene(sceneHabits, { today, theme: towerTheme, windowCount }),
    [sceneHabits, today, towerTheme, windowCount],
  );

  const lots = useMemo(
    () => buildLots(lotHabits.map((h) => toLotHabit(h, categoryColors)), { today }),
    [lotHabits, categoryColors, today],
  );

  const habitsById = useMemo(() => {
    const map = {};
    habits.forEach((h) => {
      map[h.id] = h;
    });
    return map;
  }, [habits]);

  // Header's "X of Y built today" — daily-target habits only (matches
  // TodayScreen's own "Due Today" convention); a weekly/monthly-target habit
  // isn't "due" on any single day, so it would skew this count.
  const dueTodayCount = useMemo(() => {
    const due = towerHabits.filter((h) => isDueToday(h) || h.checkedInToday);
    return { total: due.length, done: due.filter((h) => h.checkedInToday).length };
  }, [towerHabits]);

  // "Open today" for the Daily view's inactive-tab badge — due and not yet
  // built, the same notion dueTodayCount already computes, just the gap
  // rather than the x-of-y pair.
  const dailyOpenToday = dueTodayCount.total - dueTodayCount.done;

  // The one correctness-critical rule in this screen: a BOOLEAN habit
  // already checked in today can't be held again — toggleCheckIn is a
  // toggle, and allowing a second hold would delete today's check-in. COUNT
  // habits have no such ceiling; each hold logs one more unit, same as the
  // existing Today screen's "+1" tap.
  const getCanBuild = useCallback(
    (habitId) => {
      const habit = habitsById[habitId];
      if (!habit) return false;
      if (isCountMode(habit)) return true;
      return !habit.checkedInToday;
    },
    [habitsById],
  );

  const handleBuild = useCallback(
    async (habitId) => {
      const habit = habitsById[habitId];
      if (!habit) return;
      try {
        if (isCountMode(habit)) {
          await addCheckIn(habitId, 1);
        } else if (!habit.checkedInToday) {
          await toggleCheckIn(habitId);
        }
        setHasBuiltOnce(true);
      } catch (err) {
        showToast(`Could not update check-in — ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      }
    },
    [habitsById, addCheckIn, toggleCheckIn, showToast],
  );

  // The lot-sheet mockups (concept _screens/3-lot-sheet-weekly.png and
  // 5-lot-sheet-monthly.png) show "Add for another day" opening a sheet to
  // backdate or remove a check-in for a specific day in the period — that
  // sheet is a separate, not-yet-built screen (tracked in SKYLINE.md), so
  // this stands the entry point up now without building the sheet behind
  // it yet.
  const handleAddForAnotherDay = useCallback(
    (habitId) => {
      const habit = habitsById[habitId];
      showToast(`Pick a day to add a ${habit ? habit.name : 'habit'} check-in — coming soon`, 'info');
    },
    [habitsById, showToast],
  );

  // Same sensible-defaults template flow as TodayScreen's own empty state —
  // the Skyline's empty-lot tap doesn't need the full "Lay a foundation"
  // form to offer a fast first habit (that form is Phase 4 scope).
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
        setAddHabitVisible(false);
      } catch (err) {
        showToast(`Could not add habit — ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      }
    },
    [createHabit, showToast],
  );

  return (
    <View style={styles.pageRoot}>
      <View style={StyleSheet.absoluteFill}>
        <SkyBackdrop
          stops={skyStops}
          kind={currentSkyKind}
          now={today}
          width={windowWidth}
          height={windowHeight}
          iconY={headerAreaHeight > 0 ? insets.top + headerAreaHeight + 55 : undefined}
        />
      </View>
      <SafeAreaView style={styles.root} edges={['top']}>
        <View onLayout={(e) => setHeaderAreaHeight(e.nativeEvent.layout.height)}>
        <View style={[styles.header, { backgroundColor: hexToRgba(ui.background, 0.55) }]}>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: ui.text }]}>Skyline</Text>
            <Text style={[styles.subtitle, { color: ui.muted }]}>
              {formatHeaderDate(today)} · {dueTodayCount.done} of {dueTodayCount.total} built today
            </Text>
          </View>
          <Pressable
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Open Ask Habituate"
            onPress={() => setChatVisible(true)}
          >
            <MaterialCommunityIcons name="chat-processing-outline" size={20} color={ui.text} />
          </Pressable>
          <Pressable
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={() => navigation.navigate('Profile')}
          >
            <AvatarImage uri={user?.photoURL} name={user?.displayName} size={36} />
          </Pressable>
        </View>

        <View style={styles.viewSwitch}>
          <Pressable
            testID="skyline-view-daily"
            accessibilityRole="button"
            accessibilityLabel={`Daily view${view !== 'daily' && dailyOpenToday > 0 ? `, ${dailyOpenToday} open today` : ''}`}
            onPress={() => setView('daily')}
            style={[
              styles.viewSwitchSeg,
              { backgroundColor: hexToRgba(ui.background, 0.55) },
              view === 'daily' && { borderColor: ui.amber, borderWidth: 1.5 },
            ]}
          >
            <Text style={[styles.viewSwitchText, { color: ui.text }]}>Daily</Text>
            {view !== 'daily' && dailyOpenToday > 0 && (
              <View style={[styles.badge, { backgroundColor: ui.amber }]}>
                <Text style={styles.badgeText}>{dailyOpenToday}</Text>
              </View>
            )}
          </Pressable>
          <Pressable
            testID="skyline-view-lots"
            accessibilityRole="button"
            accessibilityLabel={`Weekly and monthly view${view !== 'lots' && lots.openToday > 0 ? `, ${lots.openToday} open today` : ''}`}
            onPress={() => setView('lots')}
            style={[
              styles.viewSwitchSeg,
              { backgroundColor: hexToRgba(ui.background, 0.55) },
              view === 'lots' && { borderColor: ui.amber, borderWidth: 1.5 },
            ]}
          >
            <Text style={[styles.viewSwitchText, { color: ui.text }]}>Weekly & Monthly</Text>
            {view !== 'lots' && lots.openToday > 0 && (
              <View style={[styles.badge, { backgroundColor: ui.amber }]}>
                <Text style={styles.badgeText}>{lots.openToday}</Text>
              </View>
            )}
          </Pressable>
        </View>
        </View>

        {loading && habits.length === 0 ? (
        // Only the true cold-start case blanks the screen — `loading` also
        // flips true→false on every refresh after a check-in (useHabits.js's
        // `run()` wraps every mutation in a refresh), and gating the whole
        // tree on that alone unmounted/remounted the entire skyline on every
        // single floor build, flashing blank each time.
        <Text style={[styles.loading, { color: ui.muted }]}>Loading your skyline…</Text>
      ) : view === 'lots' ? (
        <View style={styles.stage}>
          <LotsView
            rows={lots.rows}
            habitsById={habitsById}
            getCanBuild={getCanBuild}
            onBuild={handleBuild}
            onAddForAnotherDay={handleAddForAnotherDay}
            tapToBuild={tapToBuild}
            theme={ui}
          />
        </View>
      ) : (
        <View style={styles.stage} onLayout={(e) => setStageHeight(e.nativeEvent.layout.height)}>
          {/* Cropped from the top (sky), never the bottom — a short screen
              shows less sky above the towers, not a tower's base/labels
              clipped off behind the collapsed sheet (see SHEET_PEEK_HEIGHT). */}
          <View
            style={[
              styles.sceneWrap,
              stageHeight > 0 && { height: Math.min(560, stageHeight - SHEET_PEEK_HEIGHT) },
            ]}
          >
            <View style={styles.sceneAnchorBottom}>
              <SkylineView
                habits={sceneHabits}
                scene={scene}
                containerWidth={windowWidth}
                showTouchables={false}
                theme={ui}
                onAddHabit={() => setAddHabitVisible(true)}
                interactiveOverlay={
                  <SkylineHoldLayer
                    hitTargets={scene.hitTargets}
                    labels={scene.accessibilityLabels}
                    getCanBuild={getCanBuild}
                    onBuild={handleBuild}
                    tapToBuild={tapToBuild}
                    theme={ui}
                  />
                }
              />
            </View>
          </View>
          <SkylineHabitSheet
            habits={sceneHabits}
            getCanBuild={getCanBuild}
            onBuild={handleBuild}
            tapToBuild={tapToBuild}
            theme={ui}
            stageHeight={stageHeight}
          />
        </View>
      )}

      <Toast toast={toast} onHide={hideToast} />
      <LocationPermissionModal
        visible={hasBuiltOnce && needsLocationPrompt}
        onAllow={requestLocation}
        onDismiss={skipLocationPrompt}
      />
      <AskHabituateModal visible={chatVisible} onClose={() => setChatVisible(false)} habits={habits} />
      <Modal visible={addHabitVisible} transparent animationType="fade" onRequestClose={() => setAddHabitVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAddHabitVisible(false)}>
          <Pressable style={[styles.addHabitCard, { backgroundColor: ui.surfaceLow }]} onPress={() => {}}>
            <Text style={[styles.title, { color: ui.text, marginBottom: 12 }]}>Lay a foundation</Text>
            <TemplateHabitsPicker onSelect={handleAddTemplateHabit} />
          </Pressable>
        </Pressable>
      </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageRoot: { flex: 1 },
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 24,
  },
  headerText: { flex: 1 },
  title: { fontFamily: fonts.extraBold, fontSize: 28 },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, marginTop: 2 },
  iconBtn: { marginLeft: 10 },
  viewSwitch: { flexDirection: 'row', paddingHorizontal: 12, marginBottom: 8, gap: 8 },
  viewSwitchSeg: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  viewSwitchText: { fontFamily: fonts.semiBold, fontSize: 13 },
  badge: {
    marginLeft: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, color: '#1A1300' },
  loading: { padding: 24, fontSize: 14 },
  stage: { flex: 1, overflow: 'hidden' },
  sceneWrap: { height: 560, overflow: 'hidden' },
  sceneAnchorBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 560 },
  backdrop: { flex: 1, backgroundColor: 'rgba(8,10,16,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  addHabitCard: { width: '100%', maxWidth: 420, borderRadius: 20, padding: 20 },
});
