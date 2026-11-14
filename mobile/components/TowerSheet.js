import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg from 'react-native-svg';
import ConfirmModal from './ConfirmModal';
import Toast from './Toast';
import HoldPillButton from './HoldPillButton';
import { DayGrid } from './LotTile';
import { useConfirm } from '../hooks/useConfirm';
import { useToast } from '../hooks/useToast';
import { useHabits } from '../hooks/useHabits';
import { isCountMode } from '../utils/cadence';
import { buildDays } from '../utils/lots';
import { categoryColor } from '../constants/habitCategories';
import { toDateKey } from '../utils/date';
import { fonts } from '../theme';

const MS_PER_DAY = 86400000;
const DEFAULT_TOP_OUT_THRESHOLD_DAYS = 30;
const BACKDATE_WINDOW_DAYS = 7; // matches weekly/monthly's own "Add for another day" reach (SKYLINE.md section 14 #14)
const GRID_PAD = 16;
const GRID_GAP = 6;
const GRID_COLS = 7;
const GRID_LABEL_H = 14; // room for the day-number text under the row (DayGrid's dayNumbers=true)

/**
 * Phase 3b's tower sheet (SKYLINE.md section 9/10): stats, Edit, Shield
 * Day, Top out (gated by the habit's own `topOutThresholdDays`), "Look
 * inside" (Phase 3c's cross-section list, TowerInsideView.js), "Ask about
 * this tower", and Retire. Opened by a plain tap on a tower
 * (SkylineHoldLayer.js's composed gesture — a long press still builds,
 * a quick tap opens this sheet; the two roles swap under "Tap to build").
 *
 * Edit opens Phase 4's TowerForm.js (passed in as `onEdit`) — it used to
 * deep-link to the old HabitsScreen form via an `editHabitId` route param;
 * repointed once TowerForm existed, 2026-11-12. HabitsScreen.js itself is
 * untouched and still reachable by other paths until Phase 4's cleanup
 * commit removes it.
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
  tapToBuild,
  categoryColors,
  onAskAboutTower,
  onOpenInsideView,
  onEdit,
}) {
  const { toggleShield, updateHabit, topOutHabit, shieldsAvailable, toggleCheckIn, addCheckIn, removeCheckIn } =
    useHabits();
  const { toast, showToast, hideToast } = useToast();
  const { request, confirm, respond } = useConfirm();
  const { width: windowWidth } = useWindowDimensions();
  const todayKey = toDateKey(new Date());

  const [showBackdate, setShowBackdate] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);

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

  if (!habit) return null;

  // The raw habit record (unlike the scene/lot builders' transformed shape)
  // has no .color of its own — derive it the same way TowerForm.js does.
  const towerColor = (categoryColors && categoryColors[habit.category]) || categoryColor(habit.category);

  const totalBuilt = habit.checkIns?.length || 0;
  const currentRun = habit.streak || 0;
  const bestRun = habit.longestStreak || 0;
  const closedSegmentCount = habit.closedSegmentCount || 0;

  const ageDays = habit.createdAt
    ? Math.floor((Date.now() - new Date(habit.createdAt).getTime()) / MS_PER_DAY)
    : 0;
  const threshold = habit.topOutThresholdDays || DEFAULT_TOP_OUT_THRESHOLD_DAYS;
  const canTopOut = ageDays >= threshold;

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

  const shieldSublabel = habit.shieldedToday
    ? null
    : habit.shieldEligible
      ? `${shieldsAvailable} available`
      : 'Needs a 7+ day run';
  const shieldDisabled = !habit.shieldedToday && (!habit.shieldEligible || shieldsAvailable <= 0);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {/* HoldPillButton's GestureDetector can't reach the GestureHandlerRootView
          wrapping App.js from inside a Modal's own native surface — same gotcha
          LotSheet.js/NotificationCenterModal.js already document and work around. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn} testID="tower-sheet-close">
            <MaterialCommunityIcons name="close" size={22} color={theme.muted} />
          </Pressable>
          <View style={styles.headerTitleWrap} accessible accessibilityLabel={`Tower details, ${habit.name}`}>
            <Text style={[styles.headerEyebrow, { color: theme.muted }]}>TOWER DETAILS</Text>
            <Text
              style={[styles.headerTitle, { color: theme.text }]}
              numberOfLines={2}
              ellipsizeMode="tail"
              importantForAccessibility="no"
            >
              {habit.name}
            </Text>
          </View>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.statsRow, { backgroundColor: theme.surfaceHigh }]}>
            <StatBlock label="Current run" value={currentRun} theme={theme} />
            <StatBlock label="Best run" value={bestRun} theme={theme} />
            <StatBlock label="Total built" value={totalBuilt} theme={theme} />
          </View>
          {closedSegmentCount > 0 && (
            <Text style={[styles.earlierTowers, { color: theme.muted }]}>
              {closedSegmentCount} earlier {closedSegmentCount === 1 ? 'tower' : 'towers'} behind this one
            </Text>
          )}
          {habit.motivation ? (
            <Text style={[styles.motivation, { color: theme.muted }]}>{habit.motivation}</Text>
          ) : null}

          {canTopOut && (
            <Pressable
              onPress={handleTopOut}
              style={[styles.topOutCard, { backgroundColor: theme.surfaceHigh, borderColor: theme.amber }]}
              testID="tower-sheet-top-out"
              accessibilityRole="button"
              accessibilityLabel={`Top out, ${ageDays} days old`}
            >
              <MaterialCommunityIcons name="flag-checkered" size={24} color={theme.amber} />
              <View style={styles.topOutTextWrap}>
                <Text style={[styles.topOutLabel, { color: theme.text }]}>Top out this tower</Text>
                <Text style={[styles.topOutSublabel, { color: theme.muted }]}>{ageDays} days old</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={theme.muted} />
            </Pressable>
          )}

          <View style={styles.grid}>
            <GridButton
              icon={habit.shieldedToday ? 'shield-off-outline' : 'shield-check-outline'}
              label={habit.shieldedToday ? 'Remove Shield' : 'Shield Day'}
              sublabel={shieldSublabel}
              onPress={handleShieldToggle}
              disabled={shieldDisabled}
              theme={theme}
              testID="tower-sheet-shield"
            />
            <GridButton
              icon="calendar-arrow-left"
              label="Add another day"
              onPress={() => setShowBackdate((v) => !v)}
              theme={theme}
              testID="tower-sheet-backdate-toggle"
            />
            <GridButton
              icon="layers-outline"
              label="See inside"
              onPress={handleOpenInsideView}
              theme={theme}
              testID="tower-sheet-inside"
            />
            <GridButton
              icon="chat-processing-outline"
              label="Ask about tower"
              onPress={handleAskAboutTower}
              theme={theme}
              testID="tower-sheet-ask"
            />
            <GridButton
              icon="pencil-outline"
              label="Edit"
              onPress={handleEdit}
              theme={theme}
              testID="tower-sheet-edit"
            />
            <GridButton
              icon="archive-outline"
              label="Retire"
              onPress={handleRetire}
              theme={theme}
              testID="tower-sheet-retire"
            />
          </View>

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
                  label={`${habit.name}, ${selectedDayLabel}`}
                  theme={theme}
                />
              </View>
            </View>
          )}
        </ScrollView>

        <Toast toast={toast} onHide={hideToast} />
        <ConfirmModal request={request} onRespond={respond} />
      </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

function StatBlock({ label, value, theme }) {
  return (
    <View style={styles.statBlock}>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

// 2-column grid button (design-review board 03, owner-approved
// 2026-11-13): icon + label + optional sublabel (e.g. the Shield Day
// count), stacked vertically, min 44dp tall for a real touch target.
function GridButton({ icon, label, sublabel, onPress, disabled, theme, testID }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={[styles.gridButton, { backgroundColor: theme.surfaceHigh }]}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={sublabel ? `${label}, ${sublabel}` : label}
      accessibilityState={{ disabled: !!disabled }}
    >
      <MaterialCommunityIcons name={icon} size={20} color={disabled ? theme.muted : theme.text} />
      <Text style={[styles.gridButtonLabel, { color: disabled ? theme.muted : theme.text }]} numberOfLines={1}>
        {label}
      </Text>
      {sublabel ? (
        <Text style={[styles.gridButtonSublabel, { color: theme.muted }]} numberOfLines={1}>
          {sublabel}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  closeBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerEyebrow: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.6, marginBottom: 2 },
  headerTitle: { fontFamily: fonts.bold, fontSize: 17, textAlign: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  statsRow: { flexDirection: 'row', borderRadius: 16, paddingVertical: 18, marginBottom: 4 },
  earlierTowers: { fontFamily: fonts.regular, fontSize: 12, textAlign: 'center', marginBottom: 16 },
  motivation: { fontFamily: fonts.regular, fontStyle: 'italic', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  statBlock: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: fonts.extraBold, fontSize: 24 },
  statLabel: { fontFamily: fonts.regular, fontSize: 12, marginTop: 4 },
  topOutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 16,
  },
  topOutTextWrap: { flex: 1 },
  topOutLabel: { fontFamily: fonts.semiBold, fontSize: 15 },
  topOutSublabel: { fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  gridButton: {
    width: '47%',
    minHeight: 64,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  gridButtonLabel: { fontFamily: fonts.semiBold, fontSize: 14 },
  gridButtonSublabel: { fontFamily: fonts.regular, fontSize: 11 },
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
