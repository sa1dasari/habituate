import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ConfirmModal from './ConfirmModal';
import Toast from './Toast';
import { useConfirm } from '../hooks/useConfirm';
import { useToast } from '../hooks/useToast';
import { useHabits } from '../hooks/useHabits';
import { fonts } from '../theme';

const MS_PER_DAY = 86400000;
const DEFAULT_TOP_OUT_THRESHOLD_DAYS = 30;

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
export default function TowerSheet({ visible, onClose, habit, theme, onAskAboutTower, onOpenInsideView, onEdit }) {
  const { toggleShield, updateHabit, topOutHabit, shieldsAvailable } = useHabits();
  const { toast, showToast, hideToast } = useToast();
  const { request, confirm, respond } = useConfirm();

  if (!habit) return null;

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

  const shieldSublabel = habit.shieldedToday
    ? null
    : habit.shieldEligible
      ? `${shieldsAvailable} available`
      : 'Needs a 7+ day run';
  const shieldDisabled = !habit.shieldedToday && (!habit.shieldEligible || shieldsAvailable <= 0);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn} testID="tower-sheet-close">
            <MaterialCommunityIcons name="close" size={22} color={theme.muted} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
            {habit.name}
          </Text>
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

          <ActionRow
            icon="pencil-outline"
            label="Edit"
            onPress={handleEdit}
            theme={theme}
            testID="tower-sheet-edit"
          />
          <ActionRow
            icon={habit.shieldedToday ? 'shield-off-outline' : 'shield-check-outline'}
            label={habit.shieldedToday ? 'Remove Shield Day' : 'Shield Day'}
            sublabel={shieldSublabel}
            onPress={handleShieldToggle}
            disabled={shieldDisabled}
            theme={theme}
            testID="tower-sheet-shield"
          />
          {canTopOut && (
            <ActionRow
              icon="flag-checkered"
              label="Top out"
              sublabel={`${ageDays} days old`}
              onPress={handleTopOut}
              theme={theme}
              testID="tower-sheet-top-out"
            />
          )}
          <ActionRow
            icon="layers-outline"
            label="Look inside"
            sublabel={`${totalBuilt} floor${totalBuilt === 1 ? '' : 's'}`}
            onPress={handleOpenInsideView}
            theme={theme}
            testID="tower-sheet-inside"
          />
          <ActionRow
            icon="chat-processing-outline"
            label="Ask about this tower"
            onPress={handleAskAboutTower}
            theme={theme}
            testID="tower-sheet-ask"
          />
          <ActionRow
            icon="archive-outline"
            label="Retire"
            onPress={handleRetire}
            theme={theme}
            testID="tower-sheet-retire"
          />
        </ScrollView>

        <Toast toast={toast} onHide={hideToast} />
        <ConfirmModal request={request} onRespond={respond} />
      </SafeAreaView>
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

function ActionRow({ icon, label, sublabel, onPress, disabled, theme, testID }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={styles.actionRow}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={sublabel ? `${label}, ${sublabel}` : label}
      accessibilityState={{ disabled: !!disabled }}
    >
      <MaterialCommunityIcons name={icon} size={22} color={disabled ? theme.muted : theme.text} style={styles.actionIcon} />
      <View style={styles.actionLabelWrap}>
        <Text style={[styles.actionLabel, { color: disabled ? theme.muted : theme.text }]}>{label}</Text>
        {sublabel && <Text style={[styles.actionSublabel, { color: theme.muted }]}>{sublabel}</Text>}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={theme.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  closeBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.bold, fontSize: 17, flex: 1, textAlign: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  statsRow: { flexDirection: 'row', borderRadius: 16, paddingVertical: 18, marginBottom: 4 },
  earlierTowers: { fontFamily: fonts.regular, fontSize: 12, textAlign: 'center', marginBottom: 16 },
  statBlock: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: fonts.extraBold, fontSize: 24 },
  statLabel: { fontFamily: fonts.regular, fontSize: 12, marginTop: 4 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  actionIcon: { marginRight: 14 },
  actionLabelWrap: { flex: 1 },
  actionLabel: { fontFamily: fonts.semiBold, fontSize: 16 },
  actionSublabel: { fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
});
