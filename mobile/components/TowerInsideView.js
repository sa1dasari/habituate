import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path, Rect } from 'react-native-svg';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import Toast from './Toast';
import HoldPillButton from './HoldPillButton';
import { useToast } from '../hooks/useToast';
import { useHabits } from '../hooks/useHabits';
import { api } from '../api/client';
import { classifyDays } from '../utils/skylineScene';
import { sumValueForDay } from '../utils/dayStats';
import { cadenceTarget, isCountMode } from '../utils/cadence';
import { fonts } from '../theme';

// Each real day is its own floor (board 26) rather than the live skyline
// stage's ~60-floor tiered cap (CLAUDE.md section 4's perf budget) — that
// cap exists for the many-towers-on-screen, animated stage, which doesn't
// apply here (one tower, no animation). But react-native-svg doesn't
// virtualize, so an unbounded multi-year habit would still push thousands
// of shapes into one <Svg>. Capped to the most recent year; anything older
// folds into a footer count, same spirit as the tower sheet's own "N
// earlier towers behind this one" line.
const MAX_RENDERED_FLOORS = 365;
const FLOOR_H = 13;
const FLOOR_GAP = 1;
const TOWER_W = 104;
const TOWER_X = 20;
const TOP_PAD = 36; // room for the "Today" label above the first floor
const BOTTOM_PAD = 28;
const TRACK_RIGHT = 16;
const TOOLTIP_LEFT = TOWER_X + TOWER_W + 28;
const TOOLTIP_WIDTH = 200;

function shieldIconPath(cx, cy, w = 10, h = 11) {
  return (
    `M${cx - w / 2},${cy - h / 2}` +
    `L${cx + w / 2},${cy - h / 2}` +
    `L${cx + w / 2},${cy - h * 0.1}` +
    `L${cx},${cy + h / 2}` +
    `L${cx - w / 2},${cy - h * 0.1}Z`
  );
}

/**
 * Phase 3c's inside view, rebuilt to match design/skyline/
 * 26-inside-view-build-open-day.png (supersedes the flat-list-only version
 * — that list stays as the screen-reader fallback below the drawn tower,
 * rather than being the primary view). "Each floor is one day": a real
 * vertical tower, newest day at the top ("Today"), set/open/glass floors
 * drawn the same way skylineScene.js's main tower does (wall color +
 * lit/dark window pips for 'set', glass tint + shield icon for 'glass', a
 * plain solid-stroke outline for 'open' — solid, not dashed, per board 26's
 * legend; the main skyline tower's live "today, not yet built" floor is a
 * different state this read-only history view never shows).
 *
 * Selection is a cursor, not a scroll position (see the track/thumb on the
 * right): tapping any floor, or dragging the thumb, sets `selectedIndex`
 * and shows a tooltip card pinned next to that floor with its date, state,
 * a "Hold to build" control for an *open* day, and "Ask about this day".
 * The tooltip is laid out inside the same scrollable content as the tower
 * (not the viewport), so it scrolls naturally with the floor it points at
 * instead of needing a separate scroll-offset sync. Dragging the thumb
 * additionally scrolls the tower to keep the newly selected floor in view,
 * since the thumb's own track spans the full capped day range, not just
 * what's currently on screen.
 *
 * Backdating any past day (not just the last 7) is personal-habits only
 * (design-review board 26, 2026-11-13): the server enforces this for
 * personal habits already (HabitService allows any date back to the
 * habit's start), but has no equivalent enforcement for shared habits yet,
 * so the control is hidden here for `habit.shared` rather than shown and
 * silently relying on a client-side guard — a real gate needs a backend
 * change, tracked separately, owner's call pending.
 */
export default function TowerInsideView({
  visible,
  onClose,
  habit,
  sceneHabit,
  today,
  uiTheme,
  towerTheme,
  tapToBuild,
  onAskAboutTower,
  onAskAboutDay,
}) {
  const { toast, showToast, hideToast } = useToast();
  const { toggleCheckIn, addCheckIn } = useHabits();
  const [shieldDays, setShieldDays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showList, setShowList] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);
  const scrollRef = useRef(null);
  // Mirrors of React state the thumb's Gesture.Pan worklet needs to read —
  // a worklet runs on the UI thread and can't close over plain JS
  // state/refs the way a normal callback can (see TowerSheet.js's
  // dragGesture for the same pattern: shared values in, runOnJS out).
  const selectedIndexShared = useSharedValue(0);
  // Starts at 1, not 0 — onUpdate divides by this, and the layout effect
  // that sets the real value can't be guaranteed to run before the first
  // gesture frame; 0 would produce a NaN index instead of a harmless no-op.
  const maxIndexShared = useSharedValue(1);
  const viewportHeightShared = useSharedValue(0);
  const dragStartIndex = useSharedValue(0);
  // The index actually committed to React state/scroll — lets onUpdate
  // skip the runOnJS bridge (a setState + an imperative scrollTo) on ticks
  // that land on the same index, which is most of them at 60fps.
  const lastCommittedIndex = useSharedValue(0);
  useEffect(() => {
    selectedIndexShared.value = selectedIndex;
  }, [selectedIndex, selectedIndexShared]);
  useEffect(() => {
    viewportHeightShared.value = viewportHeight;
  }, [viewportHeight, viewportHeightShared]);

  useEffect(() => {
    if (!visible || !habit) return undefined;
    let cancelled = false;
    setShieldDays([]);
    setLoading(true);
    api
      .getShieldedDates(habit.id)
      .then((dates) => {
        if (!cancelled) setShieldDays(dates || []);
      })
      .catch((err) => {
        if (!cancelled) showToast(`Could not load Shield Days — ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, habit?.id]);

  // A newly opened tower (or a different one) always starts selected on
  // today — same reasoning as TowerSheet.js's per-habit reset effect, so a
  // stale selection from the last habit viewed can't carry over.
  useEffect(() => {
    if (visible) setSelectedIndex(0);
  }, [visible, habit?.id]);

  const todayKey = useMemo(() => {
    const d = today || new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [today]);

  const countMode = habit ? isCountMode(habit) : false;
  const target = countMode ? cadenceTarget(habit) : null;

  // Newest-first (index 0 = today, matching the board's top-to-bottom
  // reading order), capped to MAX_RENDERED_FLOORS.
  const { renderDays, earlierCount } = useMemo(() => {
    if (!sceneHabit) return { renderDays: [], earlierCount: 0 };
    const days = classifyDays({ ...sceneHabit, shieldDays }, todayKey);
    if (days.length === 0) return { renderDays: [], earlierCount: 0 };

    const litIndices = new Set();
    if (sceneHabit.currentRun > 0) {
      for (let i = days.length - 1; i >= 0 && litIndices.size < sceneHabit.currentRun; i -= 1) {
        if (days[i].state !== 'set') break;
        litIndices.add(i);
      }
    }

    const newestFirst = [];
    for (let i = days.length - 1; i >= 0; i -= 1) {
      const entry = days[i];
      newestFirst.push({
        ...entry,
        lit: litIndices.has(i),
        isToday: entry.day === todayKey,
        value: countMode ? sumValueForDay(habit, entry.day) : null,
      });
    }

    const capped = newestFirst.slice(0, MAX_RENDERED_FLOORS);
    return { renderDays: capped, earlierCount: Math.max(0, newestFirst.length - capped.length) };
  }, [sceneHabit, habit, shieldDays, todayKey, countMode]);

  const bestRunEndKey = sceneHabit?.bestRun?.endDate ? String(sceneHabit.bestRun.endDate).slice(0, 10) : null;
  const bestRunIndex = bestRunEndKey ? renderDays.findIndex((d) => d.day === bestRunEndKey) : -1;

  const towerHeight = renderDays.length * (FLOOR_H + FLOOR_GAP);
  const contentHeight = TOP_PAD + towerHeight + BOTTOM_PAD + (earlierCount > 0 ? 24 : 0);

  const floorY = useCallback((index) => TOP_PAD + index * (FLOOR_H + FLOOR_GAP), []);

  const selected = renderDays[selectedIndex] || null;
  const selectedY = selected ? floorY(selectedIndex) : 0;

  useEffect(() => {
    maxIndexShared.value = Math.max(1, renderDays.length - 1);
  }, [renderDays.length, maxIndexShared]);

  const scrollToIndex = useCallback(
    (index) => {
      if (!scrollRef.current || viewportHeight === 0) return;
      const y = TOP_PAD + index * (FLOOR_H + FLOOR_GAP) - viewportHeight / 2;
      scrollRef.current.scrollTo({ y: Math.max(0, y), animated: false });
    },
    [viewportHeight]
  );

  // Gesture.Pan's onStart/onUpdate run as worklets on the UI thread and can
  // only read/write shared values — this is the one JS-thread bridge point
  // (TowerSheet.js's dragGesture uses the same shared-values-in,
  // runOnJS-out shape).
  const selectAndScroll = useCallback(
    (index) => {
      setSelectedIndex(index);
      scrollToIndex(index);
    },
    [scrollToIndex]
  );

  const thumbGesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          dragStartIndex.value = selectedIndexShared.value;
          lastCommittedIndex.value = selectedIndexShared.value;
        })
        .onUpdate((event) => {
          if (viewportHeightShared.value === 0) return;
          const track = viewportHeightShared.value - 24;
          const startY = (dragStartIndex.value / maxIndexShared.value) * track;
          const nextY = Math.min(track, Math.max(0, startY + event.translationY));
          const nextIndex = Math.round((nextY / track) * maxIndexShared.value);
          // Most ticks of a drag land on the same index — skip the
          // setState+scrollTo bridge unless the selection actually moved,
          // otherwise the tooltip (derived from selectedIndex) re-renders
          // every frame and visibly chases the imperative scroll.
          if (nextIndex !== lastCommittedIndex.value) {
            lastCommittedIndex.value = nextIndex;
            runOnJS(selectAndScroll)(nextIndex);
          }
        }),
    [dragStartIndex, selectedIndexShared, viewportHeightShared, maxIndexShared, lastCommittedIndex, selectAndScroll]
  );

  if (!habit) return null;

  const handleAsk = () => {
    onClose();
    if (selected && onAskAboutDay) onAskAboutDay(habit, selected.day);
    else onAskAboutTower?.(habit);
  };

  const handleSelectFloor = (index) => setSelectedIndex(index);

  const handleBuild = async () => {
    if (!selected) return;
    try {
      if (countMode) {
        await addCheckIn(habit.id, 1, selected.day);
      } else {
        await toggleCheckIn(habit.id, selected.day);
      }
    } catch (err) {
      showToast(`Could not update check-in — ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  const monthLabelY = new Set();
  const monthLabels = [];
  renderDays.forEach((entry, i) => {
    const dayOfMonth = Number(entry.day.slice(8, 10));
    if (dayOfMonth === 1 || i === renderDays.length - 1) {
      const key = entry.day.slice(0, 7);
      if (!monthLabelY.has(key)) {
        monthLabelY.add(key);
        monthLabels.push({ key: `${key}-${i}`, y: floorY(i), label: shortMonthLabel(entry.day) });
      }
    }
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {/* The scrub thumb's GestureDetector needs its own root — the
          GestureHandlerRootView wrapping App.js doesn't extend into a
          Modal's separate native surface (see NotificationCenterModal.js,
          LotSheet.js for the same pattern). */}
      <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: uiTheme.background }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.backBtn} testID="tower-inside-back">
            <MaterialCommunityIcons name="chevron-left" size={24} color={uiTheme.text} />
            <Text style={[styles.backLabel, { color: uiTheme.text }]} numberOfLines={1}>
              Tower details
            </Text>
          </Pressable>
          <View style={{ width: 34 }} />
        </View>

        <View style={styles.titleBlock} accessible accessibilityLabel={`Inside view, ${habit.name}`}>
          <Text style={[styles.title, { color: uiTheme.text }]}>Inside view</Text>
          <Text
            style={[styles.habitName, { color: uiTheme.muted }]}
            numberOfLines={2}
            ellipsizeMode="tail"
            importantForAccessibility="no"
          >
            {habit.name}
          </Text>
        </View>

        <Text style={[styles.subtitle, { color: uiTheme.muted }]}>
          Each floor is one day. Drag the handle to move through time.
        </Text>

        <View style={styles.stage} onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}>
          <ScrollView ref={scrollRef} contentContainerStyle={{ height: contentHeight }} showsVerticalScrollIndicator={false}>
            {monthLabels.map((m) => (
              <Text key={m.key} style={[styles.monthLabel, { top: m.y - 6, color: uiTheme.muted }]}>
                {m.label}
              </Text>
            ))}

            <Svg
              width={TOWER_X + TOWER_W + 4}
              height={contentHeight}
              viewBox={`0 0 ${TOWER_X + TOWER_W + 4} ${contentHeight}`}
              style={styles.towerSvg}
            >
              {bestRunIndex >= 0 && (
                <Path
                  d={`M${TOWER_X - 4},${floorY(bestRunIndex)}L${TOWER_X + TOWER_W + 4},${floorY(bestRunIndex)}`}
                  stroke={towerTheme.ledgeColor}
                  strokeWidth={2}
                />
              )}
              {renderDays.map((entry, i) => {
                const y = floorY(i);
                const isSelected = i === selectedIndex;
                let fill = 'transparent';
                let stroke = towerTheme.openStroke;
                let strokeWidth = 1.2;
                let opacity = 1;
                if (entry.state === 'set') {
                  fill = sceneHabit.color;
                  stroke = 'transparent';
                } else if (entry.state === 'glass') {
                  fill = towerTheme.shieldFill;
                  stroke = towerTheme.shieldEdge;
                  strokeWidth = 1.2;
                  opacity = 0.45;
                }
                return (
                  <React.Fragment key={entry.day}>
                    <Rect
                      x={TOWER_X}
                      y={y}
                      width={TOWER_W}
                      height={FLOOR_H}
                      rx={2}
                      fill={fill}
                      opacity={opacity}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                    />
                    {entry.state === 'set' && (
                      <>
                        <Rect x={TOWER_X + 14} y={y + FLOOR_H / 2 - 1.5} width={14} height={3} rx={1} fill={entry.lit ? towerTheme.windowLit : towerTheme.windowDark} />
                        <Rect x={TOWER_X + 44} y={y + FLOOR_H / 2 - 1.5} width={14} height={3} rx={1} fill={entry.lit ? towerTheme.windowLit : towerTheme.windowDark} />
                        <Rect x={TOWER_X + 74} y={y + FLOOR_H / 2 - 1.5} width={14} height={3} rx={1} fill={entry.lit ? towerTheme.windowLit : towerTheme.windowDark} />
                      </>
                    )}
                    {entry.state === 'glass' && (
                      <Path d={shieldIconPath(TOWER_X + TOWER_W / 2, y + FLOOR_H / 2)} fill={towerTheme.shieldIcon} />
                    )}
                    {isSelected && (
                      <Rect
                        x={TOWER_X - 2}
                        y={y - 2}
                        width={TOWER_W + 4}
                        height={FLOOR_H + 4}
                        rx={3}
                        fill="none"
                        stroke="#FFFFFF"
                        strokeWidth={1.6}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </Svg>

            {renderDays.map((entry, i) => (
              <Pressable
                key={`hit-${entry.day}`}
                onPress={() => handleSelectFloor(i)}
                style={[styles.floorHit, { top: floorY(i), left: TOWER_X, width: TOWER_W, height: FLOOR_H }]}
                accessible={false}
              />
            ))}

            {renderDays.length > 0 && (
              <Text style={[styles.todayLabel, { top: floorY(0) - 20, left: TOWER_X, color: uiTheme.muted }]}>Today</Text>
            )}

            {earlierCount > 0 && (
              <Text style={[styles.earlierLabel, { top: TOP_PAD + towerHeight + 4, left: TOWER_X, color: uiTheme.muted }]}>
                {earlierCount} earlier floor{earlierCount === 1 ? '' : 's'}
              </Text>
            )}

            {selected && (
              <View style={[styles.tooltip, { top: Math.max(0, selectedY - 10), backgroundColor: uiTheme.surfaceHigh }]}>
                <Text style={[styles.tooltipDate, { color: uiTheme.text }]}>
                  {formatDayLabel(selected.day)}
                  {selected.isToday ? ' · Today' : ''}
                </Text>
                <Text style={[styles.tooltipState, { color: uiTheme.muted }]}>{stateLabel(selected, target)}</Text>

                {selected.state === 'open' ? (
                  habit.shared ? (
                    <Text style={[styles.sharedNote, { color: uiTheme.muted }]}>
                      Shared habits can backdate up to 7 days, from the tower sheet's Add another day.
                    </Text>
                  ) : (
                    <View style={styles.holdWrap}>
                      <HoldPillButton
                        built={false}
                        canBuild
                        tapToBuild={tapToBuild}
                        onBuild={handleBuild}
                        color={sceneHabit.color}
                        label={`${habit.name}, ${formatDayLabel(selected.day)}`}
                        theme={uiTheme}
                      />
                    </View>
                  )
                ) : null}

                <Pressable onPress={handleAsk} hitSlop={8} testID="tower-inside-ask-day">
                  <Text style={[styles.askDayLabel, { color: uiTheme.amber || uiTheme.text }]}>Ask about this day</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>

          {renderDays.length > 1 && viewportHeight > 0 && (
            <GestureDetector gesture={thumbGesture}>
              <View style={[styles.trackWrap, { right: TRACK_RIGHT, height: viewportHeight }]}>
                <View style={[styles.track, { backgroundColor: uiTheme.border || 'rgba(128,128,128,0.3)' }]} />
                <View
                  style={[
                    styles.thumb,
                    {
                      top: (selectedIndex / Math.max(1, renderDays.length - 1)) * (viewportHeight - 24),
                      backgroundColor: '#FFFFFF',
                    },
                  ]}
                  testID="tower-inside-scrub-thumb"
                >
                  <View style={styles.thumbDot} />
                </View>
              </View>
            </GestureDetector>
          )}
        </View>

        <View style={[styles.legendRow, { borderTopColor: uiTheme.border || 'rgba(128,128,128,0.2)' }]}>
          <LegendChip swatch={<View style={[styles.legendSwatch, { backgroundColor: sceneHabit?.color }]} />} label="This run" />
          <LegendChip swatch={<View style={[styles.legendSwatch, { backgroundColor: sceneHabit?.color, opacity: 0.55 }]} />} label="Earlier" />
          <LegendChip
            swatch={<View style={[styles.legendSwatch, { backgroundColor: towerTheme.shieldFill, opacity: 0.45, borderWidth: 1, borderColor: towerTheme.shieldEdge }]} />}
            label="Shield Day"
          />
          <LegendChip swatch={<View style={[styles.legendSwatch, { borderWidth: 1.2, borderColor: towerTheme.openStroke }]} />} label="Open" />
        </View>

        <Pressable
          onPress={() => setShowList((v) => !v)}
          style={styles.listToggle}
          testID="tower-inside-list-toggle"
          accessibilityRole="button"
        >
          <Text style={[styles.listToggleText, { color: uiTheme.amber || uiTheme.text }]}>
            {showList ? 'Hide list' : 'View as list'}
          </Text>
          <MaterialCommunityIcons name={showList ? 'chevron-up' : 'chevron-down'} size={18} color={uiTheme.amber || uiTheme.text} />
        </Pressable>

        {showList && (
          <DayListFallback renderDays={renderDays} target={target} uiTheme={uiTheme} towerTheme={towerTheme} loading={loading} />
        )}

        <Pressable
          onPress={() => {
            onClose();
            onAskAboutTower?.(habit);
          }}
          style={[styles.askRow, { borderTopColor: uiTheme.border || 'rgba(128,128,128,0.2)' }]}
          testID="tower-inside-ask"
        >
          <MaterialCommunityIcons name="chat-processing-outline" size={20} color={uiTheme.amber || uiTheme.text} />
          <Text style={[styles.askLabel, { color: uiTheme.amber || uiTheme.text }]}>Ask about this tower</Text>
        </Pressable>

        <Toast toast={toast} onHide={hideToast} />
      </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

function shortMonthLabel(dayKey) {
  return new Date(`${dayKey}T00:00:00`).toLocaleDateString('en-US', { month: 'short' });
}

function formatDayLabel(dayKey) {
  return new Date(`${dayKey}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function stateLabel(entry, target) {
  const base = entry.state === 'set' ? 'Set' : entry.state === 'glass' ? 'Shield Day' : 'Open · no check-in';
  if (target != null && entry.state === 'set') return `${base} · ${entry.value}`;
  if (target != null && entry.state === 'open' && entry.value > 0) return `Open · ${entry.value} of ${target}`;
  return base;
}

function LegendChip({ swatch, label }) {
  return (
    <View style={styles.legendChip}>
      {swatch}
      <Text style={styles.legendChipText}>{label}</Text>
    </View>
  );
}

// Screen-reader equivalent of the drawn tower above (importantForAccessibility
// on the SVG/Pressable layer isn't set up for VoiceOver/TalkBack to read
// floor-by-floor meaningfully) — a plain list carries the same per-day
// state a sighted user gets from the drawing, same list this view used
// before the visual rebuild.
function DayListFallback({ renderDays, target, uiTheme, towerTheme, loading }) {
  if (renderDays.length === 0) {
    return !loading ? <Text style={[styles.empty, { color: uiTheme.muted }]}>No floors yet.</Text> : null;
  }
  return (
    <ScrollView style={styles.listPanel} testID="tower-inside-list">
      {renderDays.map((entry) => (
        <DayRow key={entry.day} entry={entry} target={target} uiTheme={uiTheme} towerTheme={towerTheme} />
      ))}
    </ScrollView>
  );
}

function DayRow({ entry, target, uiTheme, towerTheme }) {
  const label = stateLabel(entry, target);
  const swatchStyle =
    entry.state === 'glass'
      ? { backgroundColor: towerTheme.shieldFill, opacity: 0.45, borderWidth: 1.2, borderColor: towerTheme.shieldEdge }
      : entry.state === 'open'
        ? { backgroundColor: 'transparent', borderWidth: 1.2, borderColor: towerTheme.openStroke }
        : { backgroundColor: towerTheme.windowLit };
  return (
    <View style={styles.dayRow} accessibilityLabel={`${formatDayLabel(entry.day)}, ${label}${entry.isToday ? ', today' : ''}`}>
      <View style={[styles.daySwatch, swatchStyle]}>
        {entry.state === 'glass' && <MaterialCommunityIcons name="shield" size={10} color={towerTheme.shieldIcon} />}
      </View>
      <Text style={[styles.dayDate, { color: uiTheme.text }]}>
        {formatDayLabel(entry.day)}
        {entry.isToday ? ' · Today' : ''}
      </Text>
      <Text style={[styles.dayState, { color: uiTheme.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backLabel: { fontFamily: fonts.semiBold, fontSize: 15, marginLeft: 2 },
  titleBlock: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 4 },
  title: { fontFamily: fonts.bold, fontSize: 18 },
  habitName: { fontFamily: fonts.semiBold, fontSize: 14, textAlign: 'center', marginTop: 2 },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, textAlign: 'center', paddingHorizontal: 24, paddingTop: 6, paddingBottom: 8 },
  stage: { flex: 1, position: 'relative' },
  towerSvg: { position: 'absolute', top: 0, left: 0 },
  monthLabel: { position: 'absolute', left: 0, fontFamily: fonts.semiBold, fontSize: 11 },
  floorHit: { position: 'absolute' },
  todayLabel: { position: 'absolute', fontFamily: fonts.semiBold, fontSize: 12, marginLeft: TOWER_W + 8 },
  earlierLabel: { position: 'absolute', fontFamily: fonts.regular, fontSize: 12 },
  tooltip: {
    position: 'absolute',
    left: TOOLTIP_LEFT,
    width: TOOLTIP_WIDTH,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  tooltipDate: { fontFamily: fonts.bold, fontSize: 15 },
  tooltipState: { fontFamily: fonts.regular, fontSize: 13 },
  holdWrap: { marginTop: 6, marginBottom: 2 },
  sharedNote: { fontFamily: fonts.regular, fontSize: 12, marginTop: 4 },
  askDayLabel: { fontFamily: fonts.semiBold, fontSize: 13, marginTop: 4 },
  trackWrap: { position: 'absolute', top: 0, width: 32, alignItems: 'center' },
  // Spans the full trackWrap height to match the thumb's travel range
  // ([0, viewportHeight-24], a 24px-tall thumb) — the thumb's own size
  // already centers it 12px in from each end, so no separate inset here.
  track: { position: 'absolute', top: 0, bottom: 0, width: 2, borderRadius: 1 },
  thumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  thumbDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#000000' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingHorizontal: 20, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  legendChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSwatch: { width: 12, height: 12, borderRadius: 3 },
  legendChipText: { fontFamily: fonts.regular, fontSize: 11, color: '#9AA3B2' },
  listToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
  },
  listToggleText: { fontFamily: fonts.semiBold, fontSize: 13 },
  listPanel: { maxHeight: 220, paddingHorizontal: 20 },
  dayRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  daySwatch: { width: 16, height: 16, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  dayDate: { fontFamily: fonts.semiBold, fontSize: 14, flex: 1 },
  dayState: { fontFamily: fonts.regular, fontSize: 13 },
  empty: { fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', paddingTop: 40 },
  askRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  askLabel: { fontFamily: fonts.semiBold, fontSize: 15 },
});
