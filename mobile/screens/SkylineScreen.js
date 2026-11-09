import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHabits } from '../hooks/useHabits';
import { useAppTheme } from '../hooks/useAppTheme';
import { useTapToBuild } from '../hooks/useTapToBuild';
import { useWindowCount } from '../hooks/useWindowCount';
import { useWeatherSky } from '../hooks/useWeatherSky';
import { useToast } from '../hooks/useToast';
import Toast from '../components/Toast';
import LocationPermissionModal from '../components/LocationPermissionModal';
import { HABIT_CATEGORY_COLORS } from '../constants/habitCategories';
import { buildCategoryTowerColors, skyGradients, skylineTowerTheme, skylineUI } from '../theme';
import { buildScene } from '../utils/skylineScene';
import { toSceneHabit } from '../utils/skylineAdapter';
import { skyKind } from '../utils/sky';
import { isCountMode } from '../utils/cadence';
import SkylineView from '../components/SkylineView';
import SkylineHoldLayer from '../components/SkylineHoldLayer';

/**
 * The real Skyline screen (SKYLINE.md Phase 2), wired to the existing
 * useHabits hook — unlike screens/dev/SkylineEngineScreen.js, which only
 * ever renders fixtures. Not yet registered as the live "Today"/"Skyline"
 * tab: Shield Day toggle and streak repair live in the tower sheet, which
 * is Phase 3, so renaming the tab now would lose capability versus the old
 * TodayScreen. Reachable for now via the __DEV__ tab in App.js.
 */

const towerColorsByMode = buildCategoryTowerColors(HABIT_CATEGORY_COLORS);
const SKY_REFRESH_MS = 60000;

export default function SkylineScreen() {
  const { habits, loading, toggleCheckIn, addCheckIn } = useHabits();
  const { effectiveMode } = useAppTheme();
  const { tapToBuild } = useTapToBuild();
  const { windowCount } = useWindowCount();
  const { toast, showToast, hideToast } = useToast();
  const { needsLocationPrompt, weatherCode, sunrise, sunset, requestLocation, skipLocationPrompt } =
    useWeatherSky();
  const [today, setToday] = useState(() => new Date());
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
  const skyStops = skyGradients[effectiveMode][skyKind({ now: today, sunrise, sunset, weatherCode })];

  const sceneHabits = useMemo(
    () => habits.map((h) => toSceneHabit(h, categoryColors)),
    [habits, categoryColors],
  );

  const scene = useMemo(
    () => buildScene(sceneHabits, { today, theme: towerTheme, windowCount }),
    [sceneHabits, today, towerTheme, windowCount],
  );

  const habitsById = useMemo(() => {
    const map = {};
    habits.forEach((h) => {
      map[h.id] = h;
    });
    return map;
  }, [habits]);

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

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: ui.background }]} edges={['top']}>
      {loading && habits.length === 0 ? (
        // Only the true cold-start case blanks the screen — `loading` also
        // flips true→false on every refresh after a check-in (useHabits.js's
        // `run()` wraps every mutation in a refresh), and gating the whole
        // tree on that alone unmounted/remounted the entire skyline on every
        // single floor build, flashing blank each time.
        <Text style={[styles.loading, { color: ui.muted }]}>Loading your skyline…</Text>
      ) : (
        <View style={styles.sceneWrap}>
          <SkylineView
            habits={sceneHabits}
            scene={scene}
            skyStops={skyStops}
            containerWidth={390}
            showTouchables={false}
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
      )}
      <Toast toast={toast} onHide={hideToast} />
      <LocationPermissionModal
        visible={hasBuiltOnce && needsLocationPrompt}
        onAllow={requestLocation}
        onDismiss={skipLocationPrompt}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { padding: 24, fontSize: 14 },
  sceneWrap: { height: 560 },
});
