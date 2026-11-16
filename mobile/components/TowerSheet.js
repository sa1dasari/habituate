import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg from 'react-native-svg';
import ConfirmModal from './ConfirmModal';
import Toast from './Toast';
import HoldPillButton from './HoldPillButton';
import SkylineTower from './SkylineTower';
import { DayGrid } from './LotTile';
import { useConfirm } from '../hooks/useConfirm';
import { useToast } from '../hooks/useToast';
import { useHabits } from '../hooks/useHabits';
import { isCountMode } from '../utils/cadence';
import { buildDays } from '../utils/lots';
import { categoryColor } from '../constants/habitCategories';
import { toDateKey } from '../utils/date';
import { buildScene, classifyDays, X0, TOWER_W, DX, CRANE_HEIGHT, FLOOR_H, BASE_Y } from '../utils/skylineScene';
import { toSceneHabit } from '../utils/skylineAdapter';
import api from '../api/client';
import { fonts } from '../theme';

const MS_PER_DAY = 86400000;
const DEFAULT_TOP_OUT_THRESHOLD_DAYS = 30;
const BACKDATE_WINDOW_DAYS = 7; // matches weekly/monthly's own "Add for another day" reach (SKYLINE.md section 14 #14)
const GRID_PAD = 16;
const GRID_GAP = 6;
const GRID_COLS = 7;
const GRID_LABEL_H = 14; // room for the day-number text under the row (DayGrid's dayNumbers=true)
const SHEET_TOP_PEEK = 90; // sky left visible above the sheet when open (design-review board 03)
const DISMISS_DISTANCE = 120; // drag-down distance that counts as "let go of the sheet"

/**
 * Tower details (SKYLINE.md section 9/10, design-review board 03 —
 * rebuilt 2026-11-13 to a bottom sheet over the live sky, replacing the
 * original full-screen Modal). Rendered as a permanent sibling in
 * SkylineScreen.js's own tree (like SkylineHabitSheet.js), animated by
 * `visible` rather than mounted/unmounted, so the sky stays visible above
 * it and the open/close transition can slide rather than hard-cut.
 *
 * Stats: Edit, Shield Day, Top out (gated by the habit's own
 * `topOutThresholdDays`), "Add another day" (backdate), "See inside"
 * (Phase 3c's cross-section list, TowerInsideView.js), "Ask about tower",
 * and Retire. Opened by a plain tap on a tower (SkylineHoldLayer.js's
 * composed gesture — a long press still builds, a quick tap opens this
 * sheet; the two roles swap under "Tap to build").
 *
 * The mini tower illustration is a real `buildScene` render of this one
 * habit (same engine the main skyline uses), cropped to its own hit-target
 * bounding box — not a hand-drawn approximation. Needs this habit's real
 * shielded dates fetched on demand (api.getShieldedDates) since
 * toSceneHabit's shieldDays stays a deliberate stub otherwise — same
 * decision TowerInsideView.js made for the same endpoint, not wired into
 * useHabits' global refresh cycle to avoid an extra request per habit on
 * every poll.
 *
 * "Best run" here is the habit's all-time longest streak
 * (HabitResponse.longestStreak), not scoped to this specific tower
 * segment — correct for every habit today since none has ever been
 * topped out yet (so there's only ever been one segment). Segment-scoped
 * stats need a segments-listing endpoint, which Part E's compositing work
 * will add; not duplicated here ahead of that need.
 *
 * Tower age (for the Top out gate) is likewise read from the habit's own
 * `createdAt`, not a segment's own `startedAt` — same reasoning, same
 * caveat: once a habit has actually been topped out once, this client-side
 * guess goes stale until Part E's endpoint exists. The server
 * (`HabitService.topOutHabit`) is the real gate regardless and rejects
 * with a specific message if this estimate is ever wrong, so the worst
 * case is a Top out button that shows a little early or late, not an
 * action that incorrectly succeeds.
 */
export default function TowerSheet({
  visible,
  onClose,
  habit,
  theme,
  towerTheme,
  tapToBuild,
  categoryColors,
  stageHeight,
  onAskAboutTower,
  onOpenInsideView,
  onEdit,
}) {
  const { toggleShield, updateHabit, topOutHabit, shieldsAvailable, toggleCheckIn, addCheckIn, removeCheckIn } =
    useHabits();
  const { toast, showToast, hideToast } = useToast();
  const { request, confirm, respond } = useConfirm();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // stageHeight is only measured while the daily view is mounted
  // (SkylineScreen.js's onLayout lives on that branch) — a user whose last
  // view was Weekly & Monthly (useSkylineView restores it from storage) can
  // open a tower sheet before that measurement ever happens. Fall back to
  // the window height so the sheet still slides instead of covering the
  // whole stage with no sky visible.
  const effectiveStageHeight = stageHeight > 0 ? stageHeight : windowHeight;
  const todayKey = toDateKey(new Date());

  const [showBackdate, setShowBackdate] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [shieldDates, setShieldDates] = useState([]);
  const scrollRef = useRef(null);
  // The backdate card renders below the pill grid, which is already close
  // to the bottom of a tall tower's content — without this, opening it just
  // appends more content below the user's current scroll position with no
  // visible change, reading as "the button does nothing" even though the
  // state did flip. A tick's delay lets the new card actually lay out
  // before we measure where "end" is.
  useEffect(() => {
    if (!showBackdate) return;
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(id);
  }, [showBackdate]);
  // Kept around through the close animation — `habit` goes null the instant
  // the caller clears towerSheetHabitId, but returning null immediately
  // would unmount this whole Animated.View and skip the slide-down, since
  // this is a permanent sibling now (not a Modal that unmounts for free).
  const [lastHabit, setLastHabit] = useState(null);
  useEffect(() => {
    if (habit) setLastHabit(habit);
  }, [habit]);
  const displayHabit = habit || lastHabit;

  // Replaces the old per-habit `key` remount (no longer possible — see
  // SkylineScreen.js's comment on why): reset the backdate picker
  // explicitly whenever a genuinely different habit opens, so a stale
  // selectedDateKey/showBackdate from the previous tower can't carry over
  // and let a Hold land on the wrong habit's day.
  // The ScrollView is a permanent sibling (not remounted per open), so its
  // scroll offset would otherwise persist from the previous tower — every
  // open starts at the top.
  useEffect(() => {
    if (visible) scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [visible, habit?.id]);

  useEffect(() => {
    if (!habit) return;
    setShowBackdate(false);
    setShowLegend(false);
    setSelectedDateKey(toDateKey(new Date()));
  }, [habit?.id]);

  const measured = effectiveStageHeight > 0;
  const openY = measured ? SHEET_TOP_PEEK : 0;
  const closedY = measured ? effectiveStageHeight : 0;
  const translateY = useSharedValue(closedY);
  const dragStartY = useSharedValue(closedY);

  useEffect(() => {
    if (!measured) return;
    translateY.value = withSpring(visible ? openY : closedY, { damping: 50, stiffness: 400 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, measured, openY, closedY]);

  const dismiss = () => onClose();

  const dragGesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          dragStartY.value = translateY.value;
        })
        .onUpdate((event) => {
          translateY.value = Math.max(openY, dragStartY.value + event.translationY);
        })
        .onEnd((event) => {
          if (event.translationY > DISMISS_DISTANCE || event.velocityY > 800) {
            // Let `dismiss` flip `visible` and the effect above own the
            // close animation (withSpring to closedY) — animating here too
            // would start a second, competing animation to the same target
            // the instant `dismiss` lands.
            runOnJS(dismiss)();
          } else {
            translateY.value = withSpring(openY, { damping: 50, stiffness: 400 });
          }
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [openY, closedY],
  );

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  // Reset before fetching so switching towers (close -> open a different
  // one, both visible transitions) never shows the previous habit's
  // shielded dates while the new fetch is still in flight.
  useEffect(() => {
    if (!visible || !habit) return undefined;
    let cancelled = false;
    setShieldDates([]);
    api
      .getShieldedDates(habit.id)
      .then((dates) => {
        if (!cancelled) setShieldDates(dates || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible, habit]);

  // A rolling last-7-days window, not a period — same reach as weekly/
  // monthly's own "Add for another day" (SKYLINE.md section 14 #14), just
  // anchored to today instead of a period boundary, since a daily habit has
  // no period to anchor to.
  const backdateDays = useMemo(() => {
    if (!habit) return [];
    const start = new Date();
    start.setDate(start.getDate() - (BACKDATE_WINDOW_DAYS - 1));
    return buildDays(start, BACKDATE_WINDOW_DAYS, habit.checkIns || [], isCountMode(habit), new Date());
  }, [habit]);

  // A day before the habit even existed has nothing to backdate into — same
  // guard LotSheet.js applies for weekly/monthly periods.
  const minDateKey = habit?.createdAt ? toDateKey(new Date(habit.createdAt)) : null;
  const isSelectableDay = (cell) => !cell.isFuture && (!minDateKey || cell.dateKey >= minDateKey);
  const selectedCell = backdateDays.find((d) => d.dateKey === selectedDateKey);
  const countMode = habit ? isCountMode(habit) : false;
  // A BOOLEAN day already built would toggle off on another Hold (undo-free
  // rule) — same guard as LotSheet.js's canBuildSelected, so a tap here
  // can't accidentally erase an existing day via the Hold gesture; removing
  // one is only ever explicit, via the Remove row below.
  const canBuildSelected = selectedCell ? isSelectableDay(selectedCell) && (countMode || selectedCell.count === 0) : false;
  const windowEntries = useMemo(() => {
    if (!habit || backdateDays.length === 0) return [];
    const windowStartKey = backdateDays[0].dateKey;
    return (habit.checkIns || [])
      .filter((ci) => toDateKey(ci.occurredAt) >= windowStartKey)
      .slice()
      .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
  }, [habit, backdateDays]);

  // The mini tower illustration: a real buildScene render of this one
  // habit, cropped to its own bounding box (scene.hitTargets[0]) — the
  // same box/floor-top math the main skyline/hold-gesture preview already
  // use, not a hand-measured guess.
  const sceneHabit = useMemo(() => {
    if (!displayHabit || !categoryColors) return null;
    return { ...toSceneHabit(displayHabit, categoryColors), shieldDays: shieldDates };
  }, [displayHabit, categoryColors, shieldDates]);
  const miniScene = useMemo(() => {
    if (!sceneHabit || !towerTheme) return null;
    return buildScene([sceneHabit], { today: new Date(), theme: towerTheme });
  }, [sceneHabit, towerTheme]);
  const miniHit = miniScene?.hitTargets?.[0];
  const miniBoxFull = miniHit
    ? { x: miniHit.x - 6, y: miniHit.y - 6, width: miniHit.width + 12, height: miniHit.height + 12 }
    : { x: X0 - 6, y: BASE_Y - FLOOR_H - CRANE_HEIGHT - 12, width: TOWER_W + DX + 12, height: FLOOR_H + CRANE_HEIGHT + 24 };
  // Scales the full tower down to fit a max display size — never crops it.
  // Cropping (the first thing tried here) cut the bottom off a tall tower
  // to cap its height, which meant no ground/base ever showed: the
  // illustration just stopped mid-floor, looking broken rather than small
  // (confirmed on-device). Scaling keeps the crane and the base both
  // visible at every tower age; floors just get thinner on a long-running
  // habit, same as board 24's own mockup does for a 41-floor example.
  const fitTowerSize = (box, maxWidth, maxHeight) => {
    const naturalHeight = maxWidth * (box.height / box.width);
    if (naturalHeight <= maxHeight) return { width: maxWidth, height: naturalHeight };
    return { width: maxHeight * (box.width / box.height), height: maxHeight };
  };
  const miniSize = fitTowerSize(miniBoxFull, 100, 130);
  // The tall layout's illustration is capped by the sheet's own available
  // height, not a fixed value — on a short phone (the 360x640 design-review
  // asked for screenshots on) a fixed cap could still run past the fold.
  // TALL_HEADER_RESERVE is a rough, fixed estimate of the handle + title
  // row + its own padding above the tower row — deliberately not measured
  // via onLayout, since a measurement-driven cap recomputing after first
  // paint is exactly the kind of thing that flips layout mid-render
  // (design-review's jitter warning).
  const sheetContentHeight = effectiveStageHeight - SHEET_TOP_PEEK;
  const TALL_HEADER_RESERVE = 180;
  const tallMaxSvgHeight = Math.max(220, sheetContentHeight - TALL_HEADER_RESERVE);
  const tallSize = fitTowerSize(miniBoxFull, 130, tallMaxSvgHeight);

  if (!displayHabit) return null;

  // The raw habit record (unlike the scene/lot builders' transformed shape)
  // has no .color of its own — derive it the same way TowerForm.js does.
  const towerColor = (categoryColors && categoryColors[displayHabit.category]) || categoryColor(displayHabit.category);

  const currentRun = displayHabit.streak || 0;
  const bestRun = displayHabit.longestStreak || 0;
  const closedSegmentCount = displayHabit.closedSegmentCount || 0;
  const floorCount = sceneHabit ? classifyDays(sceneHabit, todayKey).length : displayHabit.checkIns?.length || 0;

  const ageDays = displayHabit.createdAt
    ? Math.floor((Date.now() - new Date(displayHabit.createdAt).getTime()) / MS_PER_DAY)
    : 0;
  const threshold = displayHabit.topOutThresholdDays || DEFAULT_TOP_OUT_THRESHOLD_DAYS;
  const canTopOut = ageDays >= threshold;

  // Tall-tower side layout (design-review board 24, owner-approved
  // 2026-11-13): switches once the compact (board 03) layout would need
  // scrolling to reach the action rows. ageDays, not floorCount — floorCount
  // is computed two different ways a few lines up depending on whether
  // sceneHabit has resolved yet (classifyDays' per-calendar-day count vs. a
  // COUNT habit's raw checkIns.length, which can run well ahead of it), so
  // using it here could flip the layout mid-render — exactly the jitter
  // design-review warned against. ageDays has no such dependency. 14 is a
  // first-pass estimate; design-review asked for on-device screenshots of
  // the switch point to tune it from there.
  const TALL_TOWER_AGE_DAYS = 14;
  const isTallTower = ageDays >= TALL_TOWER_AGE_DAYS;

  const handleEdit = () => {
    onClose();
    onEdit?.(habit);
  };

  const handleShieldToggle = async () => {
    try {
      await toggleShield(habit.id);
    } catch (err) {
      showToast(`Could not update Shield Day — ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  // Sends the habit's full current field set, not just {archived: true} —
  // the backend applies optional fields (weeklyTarget/monthlyTarget/
  // motivation) unconditionally on a PUT, so a sparse body would silently
  // wipe them (see api/client.js's updateHabit comment).
  const handleRetire = async () => {
    const ok = await confirm({
      title: 'Retire this habit?',
      message: 'It moves out of your active skyline as a grey monument. Your check-ins and run history stay saved.',
      confirmLabel: 'Retire',
      cancelLabel: 'Keep it',
    });
    if (!ok) return;
    try {
      await updateHabit(habit.id, {
        name: habit.name,
        category: habit.category,
        cadenceType: habit.cadenceType,
        cadenceTarget: habit.cadenceTarget,
        weeklyTarget: habit.weeklyTarget,
        monthlyTarget: habit.monthlyTarget,
        trackingMode: habit.trackingMode,
        featuredGoal: habit.featuredGoal,
        scheduledTime: habit.scheduledTime,
        reminderEnabled: habit.reminderEnabled,
        motivation: habit.motivation,
        topOutThresholdDays: habit.topOutThresholdDays,
        archived: true,
      });
      onClose();
    } catch (err) {
      showToast(`Could not retire habit — ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  const handleTopOut = async () => {
    const ok = await confirm({
      title: 'Top out this tower?',
      message: 'The current tower gets a gold cap and fades behind a new one. Your run keeps going — nothing resets.',
      confirmLabel: 'Top out',
    });
    if (!ok) return;
    try {
      await topOutHabit(habit.id);
      onClose();
    } catch (err) {
      showToast(`Could not top out — ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  const handleAskAboutTower = () => {
    onClose();
    onAskAboutTower?.(habit);
  };

  const handleOpenInsideView = () => {
    onClose();
    onOpenInsideView?.(habit);
  };

  const handleSelectBackdateDay = (cell) => {
    if (!isSelectableDay(cell)) return;
    setSelectedDateKey(cell.dateKey);
  };

  const handleBuildBackdate = async () => {
    try {
      if (countMode) {
        await addCheckIn(habit.id, 1, selectedDateKey);
      } else {
        await toggleCheckIn(habit.id, selectedDateKey);
      }
    } catch (err) {
      showToast(`Could not update check-in — ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  const handleRemoveBackdateEntry = async (checkInId) => {
    try {
      await removeCheckIn(habit.id, checkInId);
    } catch (err) {
      showToast(`Could not remove check-in — ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  const backdateGridWidth = Math.max(200, windowWidth - 40 - 28);
  const backdateGridCellSize = (backdateGridWidth - GRID_PAD * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
  const backdateGridHeight = GRID_PAD * 2 + (backdateGridCellSize + GRID_LABEL_H);
  const selectedDayLabel = selectedCell
    ? new Date(`${selectedCell.dateKey}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : selectedDateKey;

  const shieldLabel = displayHabit.shieldedToday
    ? 'Remove Shield'
    : shieldsAvailable > 0
      ? `Shield Day · ${shieldsAvailable}`
      : 'Shield Day';
  const shieldA11yLabel = displayHabit.shieldedToday
    ? 'Remove Shield Day'
    : displayHabit.shieldEligible
      ? `Shield Day, ${shieldsAvailable} available`
      : 'Shield Day, needs a 7+ day run';
  const shieldDisabled = !displayHabit.shieldedToday && (!displayHabit.shieldEligible || shieldsAvailable <= 0);

  return (
    <>
    {/* Tap anywhere on the sky/towers peeking above the open sheet to close
        it. Rendered before the sheet so the sheet itself stays on top, and
        only while visible so it never swallows taps on the live skyline. */}
    {visible && (
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        testID="tower-sheet-backdrop"
        accessibilityRole="button"
        accessibilityLabel="Close tower details"
      />
    )}
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.sheet,
        // The sheet is translated down by SHEET_TOP_PEEK when open (see
        // openY below) — without subtracting that back out of its own
        // height, its bottom edge overhangs the stage by that same amount
        // and lands behind the tab bar, clipping whatever's at the bottom
        // of the scroll content (caught on-device: Edit/Retire, the Hold
        // pill).
        { backgroundColor: theme.background, height: measured ? effectiveStageHeight - SHEET_TOP_PEEK : '100%' },
        animatedStyle,
      ]}
    >
      <GestureDetector gesture={dragGesture}>
        <View style={styles.handleZone} testID="tower-sheet-handle">
          <View style={[styles.handle, { backgroundColor: theme.muted }]} />
        </View>
      </GestureDetector>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <View style={[styles.colorChip, { backgroundColor: towerColor }]} />
          <View style={styles.titleTextWrap} accessible accessibilityLabel={`Tower details, ${displayHabit.name}`}>
            <Text style={[styles.eyebrow, { color: theme.muted }]}>TOWER DETAILS</Text>
            <Text
              style={[styles.title, { color: theme.text }]}
              numberOfLines={2}
              ellipsizeMode="tail"
              importantForAccessibility="no"
            >
              {displayHabit.name}
            </Text>
            <Text style={[styles.meta, { color: theme.muted }]}>
              Daily · Floor {floorCount} · Under construction
            </Text>
            {displayHabit.motivation ? (
              <Text style={[styles.motivation, { color: theme.muted }]}>“{displayHabit.motivation}”</Text>
            ) : null}
          </View>
        </View>

        {(() => {
          const legendItems = (
            <>
              <LegendRow swatch={<View style={[styles.ledgeSwatch, { backgroundColor: towerTheme?.ledgeColor || '#FFFFFF' }]} />} title={`Best run: ${bestRun} days`} body="The white ledge. It stays even if the run restarts." theme={theme} />
              <LegendRow swatch={<View style={[styles.windowSwatch, { backgroundColor: towerColor }]}><View style={[styles.windowPip, { backgroundColor: towerTheme?.windowDark }]} /></View>} title="Dark windows" body="Earlier floors. Past check-ins stay." theme={theme} />
              <LegendRow
                swatch={
                  <View style={[styles.glassSwatch, { backgroundColor: towerTheme?.shieldFill, borderColor: towerTheme?.shieldEdge }]}>
                    <MaterialCommunityIcons name="shield" size={9} color={towerTheme?.shieldIcon} />
                  </View>
                }
                title="Glass floor: Shield Day"
                body="Marked with a shield. The run kept going."
                theme={theme}
              />
              <LegendRow swatch={<View style={[styles.openSwatch, { borderColor: towerTheme?.openStroke }]} />} title="Open floor" body="An outline you can see through. Floors never come down." theme={theme} />
            </>
          );

          const topOutCard = canTopOut && (
            <View style={[styles.topOutCard, { backgroundColor: theme.surfaceHigh, borderColor: theme.amber }]}>
              <View style={styles.topOutTextWrap}>
                <Text style={[styles.topOutLabel, { color: theme.text }]}>Ready to top out?</Text>
                <Text style={[styles.topOutBody, { color: theme.muted }]}>
                  You've built this tower for over {threshold} days. Finish it and start a new one whenever you like.
                </Text>
              </View>
              <Pressable
                onPress={handleTopOut}
                style={[styles.topOutButton, { backgroundColor: theme.amber }]}
                testID="tower-sheet-top-out"
                accessibilityRole="button"
                accessibilityLabel={`Top out, ${ageDays} days old`}
              >
                <Text style={styles.topOutButtonText}>Top out</Text>
              </Pressable>
            </View>
          );

          const actions = [
            { key: 'shield', label: shieldLabel, a11yLabel: shieldA11yLabel, onPress: handleShieldToggle, disabled: shieldDisabled, testID: 'tower-sheet-shield' },
            { key: 'backdate', label: 'Add another day', onPress: () => setShowBackdate((v) => !v), testID: 'tower-sheet-backdate-toggle' },
            { key: 'inside', label: 'See inside', onPress: handleOpenInsideView, testID: 'tower-sheet-inside' },
            { key: 'ask', label: 'Ask about tower', onPress: handleAskAboutTower, testID: 'tower-sheet-ask' },
            { key: 'edit', label: 'Edit', onPress: handleEdit, testID: 'tower-sheet-edit' },
            { key: 'retire', label: 'Retire', onPress: handleRetire, testID: 'tower-sheet-retire' },
          ];

          if (!isTallTower) {
            return (
              <>
                <View style={styles.runRow}>
                  <Svg width={miniSize.width} height={miniSize.height} viewBox={`${miniBoxFull.x} ${miniBoxFull.y} ${miniBoxFull.width} ${miniBoxFull.height}`}>
                    {miniScene ? <SkylineTower shapes={miniScene.shapes} /> : null}
                  </Svg>

                  <View style={styles.runTextWrap}>
                    <Text style={[styles.runHeadline, { color: theme.amber }]}>{currentRun} day run</Text>
                    <Text style={[styles.runSubtext, { color: theme.muted }]}>
                      The lit floors at the top. Today's floor will make it {currentRun + 1}.
                    </Text>
                    {legendItems}
                  </View>
                </View>

                {closedSegmentCount > 0 && (
                  <Text style={[styles.earlierTowers, { color: theme.muted }]}>
                    {closedSegmentCount} earlier {closedSegmentCount === 1 ? 'tower' : 'towers'} behind this one
                  </Text>
                )}

                {topOutCard}

                <View style={styles.grid}>
                  {actions.map((a) => (
                    <PillButton key={a.key} label={a.label} a11yLabel={a.a11yLabel} onPress={a.onPress} disabled={a.disabled} theme={theme} testID={a.testID} />
                  ))}
                </View>
              </>
            );
          }

          // Tall layout (design-review board 24): the tower goes full-height
          // on the left so it never has to compete with the legend/actions
          // for vertical space; actions become full-width rows on the
          // right instead of a 2-col grid so they stay reachable without
          // scrolling past a tall tower's taller headline column. Legend
          // moves behind a toggle — always-on inline text here would just
          // recreate the scroll problem this layout exists to fix.
          return (
            <>
              <View style={styles.tallRow}>
                <Svg width={tallSize.width} height={tallSize.height} viewBox={`${miniBoxFull.x} ${miniBoxFull.y} ${miniBoxFull.width} ${miniBoxFull.height}`}>
                  {miniScene ? <SkylineTower shapes={miniScene.shapes} /> : null}
                </Svg>

                <View style={styles.tallTextWrap}>
                  <Text style={[styles.runHeadline, { color: theme.amber }]}>{currentRun} day run</Text>
                  <Text style={[styles.runSubtext, { color: theme.muted }]}>
                    Today's floor will make it {currentRun + 1}.
                  </Text>

                  {closedSegmentCount > 0 && (
                    <Text style={[styles.earlierTowers, { color: theme.muted }]}>
                      {closedSegmentCount} earlier {closedSegmentCount === 1 ? 'tower' : 'towers'} behind this one
                    </Text>
                  )}

                  {topOutCard}

                  <View style={styles.actionList}>
                    {actions.map((a) => (
                      <ActionRow key={a.key} label={a.label} a11yLabel={a.a11yLabel} onPress={a.onPress} disabled={a.disabled} theme={theme} testID={a.testID} />
                    ))}
                  </View>

                  <Pressable onPress={() => setShowLegend((v) => !v)} hitSlop={8} testID="tower-sheet-legend-toggle">
                    <Text style={[styles.legendToggle, { color: theme.amber }]}>
                      {showLegend ? 'Hide what the floors mean' : 'What the floors mean ›'}
                    </Text>
                  </Pressable>
                  {showLegend && <View style={styles.legendExpanded}>{legendItems}</View>}
                </View>
              </View>
            </>
          );
        })()}

        {showBackdate && (
          <View style={[styles.backdateCard, { backgroundColor: theme.surfaceHigh }]}>
            <Svg width={backdateGridWidth} height={backdateGridHeight} viewBox={`0 0 ${backdateGridWidth} ${backdateGridHeight}`}>
              <DayGrid
                days={backdateDays}
                color={towerColor}
                width={backdateGridWidth}
                height={backdateGridHeight}
                pad={GRID_PAD}
                gap={GRID_GAP}
                dayNumbers
                textColor={theme.muted}
                onPressDay={handleSelectBackdateDay}
                selectedDateKey={selectedDateKey}
                minDateKey={minDateKey}
              />
            </Svg>

            {windowEntries.length > 0 && (
              <View style={styles.backdateEntries}>
                {windowEntries.map((entry) => (
                  <View key={entry.id} style={styles.entryRow}>
                    <Text style={[styles.entryText, { color: theme.muted }]}>
                      {new Date(entry.occurredAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {'  '}
                      {new Date(entry.occurredAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                    <Pressable
                      onPress={() => handleRemoveBackdateEntry(entry.id)}
                      hitSlop={8}
                      testID={`tower-sheet-backdate-remove-${entry.id}`}
                    >
                      <Text style={[styles.removeText, { color: theme.amber }]}>Remove</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.backdateBuildRow}>
              <Text style={[styles.buildForLabel, { color: theme.muted }]}>Building for {selectedDayLabel}</Text>
              <HoldPillButton
                built={!canBuildSelected}
                canBuild={canBuildSelected}
                tapToBuild={tapToBuild}
                onBuild={handleBuildBackdate}
                color={towerColor}
                label={`${displayHabit.name}, ${selectedDayLabel}`}
                theme={theme}
              />
            </View>
          </View>
        )}
      </ScrollView>

      <Toast toast={toast} onHide={hideToast} />
      <ConfirmModal request={request} onRespond={respond} />
    </Animated.View>
    </>
  );
}

function LegendRow({ swatch, title, body, theme }) {
  return (
    <View style={styles.legendRow}>
      <View style={styles.legendSwatchWrap}>{swatch}</View>
      <View style={styles.legendTextWrap}>
        <Text style={[styles.legendTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.legendBody, { color: theme.muted }]}>{body}</Text>
      </View>
    </View>
  );
}

// 2-column pill-shaped grid button (design-review board 03, owner-approved
// 2026-11-13): text only, centered, min 44dp tall for a real touch target.
function PillButton({ label, a11yLabel, onPress, disabled, theme, testID }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={[styles.pillButton, { backgroundColor: theme.surfaceHigh }]}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel || label}
      accessibilityState={{ disabled: !!disabled }}
    >
      <Text style={[styles.pillButtonText, { color: disabled ? theme.muted : theme.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

// Full-width row with a trailing chevron (board 24's tall-tower side
// layout) — same actions as PillButton's grid, just stacked instead of
// 2-column, since the right column here is narrower than the sheet itself.
function ActionRow({ label, a11yLabel, onPress, disabled, theme, testID }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={[styles.actionRow, { backgroundColor: theme.surfaceHigh }]}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel || label}
      accessibilityState={{ disabled: !!disabled }}
    >
      <Text style={[styles.actionRowText, { color: disabled ? theme.muted : theme.text }]} numberOfLines={1}>
        {label}
      </Text>
      <MaterialCommunityIcons name="chevron-right" size={18} color={disabled ? theme.muted : theme.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleZone: { alignItems: 'center', paddingVertical: 10 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  titleRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  colorChip: { width: 6, borderRadius: 3, alignSelf: 'stretch' },
  titleTextWrap: { flex: 1 },
  eyebrow: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.6 },
  title: { fontFamily: fonts.extraBold, fontSize: 24, marginTop: 2 },
  meta: { fontFamily: fonts.regular, fontSize: 13, marginTop: 4 },
  motivation: { fontFamily: fonts.regular, fontStyle: 'italic', fontSize: 13, marginTop: 8 },
  runRow: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  tallRow: { flexDirection: 'row', gap: 16, marginBottom: 20, alignItems: 'flex-start' },
  tallTextWrap: { flex: 1 },
  runTextWrap: { flex: 1 },
  runHeadline: { fontFamily: fonts.extraBold, fontSize: 26 },
  runSubtext: { fontFamily: fonts.regular, fontSize: 13, marginTop: 4, marginBottom: 14 },
  legendRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  legendSwatchWrap: { width: 22, alignItems: 'center', paddingTop: 3 },
  legendTextWrap: { flex: 1 },
  legendTitle: { fontFamily: fonts.semiBold, fontSize: 14 },
  legendBody: { fontFamily: fonts.regular, fontSize: 12, marginTop: 1 },
  ledgeSwatch: { width: 18, height: 2, borderRadius: 1 },
  windowSwatch: { width: 18, height: 14, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  windowPip: { width: 8, height: 4, borderRadius: 1 },
  glassSwatch: { width: 18, height: 14, borderRadius: 3, borderWidth: 1, opacity: 0.9, alignItems: 'center', justifyContent: 'center' },
  openSwatch: { width: 18, height: 14, borderRadius: 3, borderWidth: 1.2 },
  earlierTowers: { fontFamily: fonts.regular, fontSize: 12, marginBottom: 16 },
  topOutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 20,
  },
  topOutTextWrap: { flex: 1 },
  topOutLabel: { fontFamily: fonts.bold, fontSize: 16 },
  topOutBody: { fontFamily: fonts.regular, fontSize: 13, marginTop: 4 },
  topOutButton: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  topOutButtonText: { fontFamily: fonts.bold, fontSize: 14, color: '#1A1300' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  pillButton: {
    width: '47%',
    minHeight: 48,
    borderRadius: 999,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillButtonText: { fontFamily: fonts.semiBold, fontSize: 14 },
  actionList: { gap: 10, marginBottom: 4 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  actionRowText: { fontFamily: fonts.semiBold, fontSize: 14 },
  legendToggle: { fontFamily: fonts.semiBold, fontSize: 13, marginTop: 14 },
  legendExpanded: { marginTop: 12 },
  backdateCard: { alignSelf: 'stretch', borderRadius: 16, padding: 14, marginTop: 16, alignItems: 'center' },
  backdateEntries: { alignSelf: 'stretch', marginTop: 12 },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  entryText: { fontFamily: fonts.regular, fontSize: 13 },
  removeText: { fontFamily: fonts.semiBold, fontSize: 13 },
  backdateBuildRow: { alignItems: 'center', marginTop: 16 },
  buildForLabel: { fontFamily: fonts.semiBold, fontSize: 13, marginBottom: 10 },
});
