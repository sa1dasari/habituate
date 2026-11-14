import React from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from './Toast';
import ConfirmModal from './ConfirmModal';
import { useToast } from '../hooks/useToast';
import { useConfirm } from '../hooks/useConfirm';
import { useHabits } from '../hooks/useHabits';
import { categoryIcon } from '../constants/habitCategories';
import { fonts } from '../theme';

/**
 * Phase 4 Part I: the Skyline-reachable list of retired towers (grey
 * monuments) — SKYLINE.md section 14 decision 9 confirmed the old app
 * allows restoring one, so this screen has to too, or Phase 4's "no
 * capability lost" gate isn't met. Opened from a new header icon on
 * SkylineScreen.js; mirrors HabitsScreen.js's archived-section logic
 * (`restore`/`confirmDelete`, HabitsScreen.js:507-513/490-505) rather than
 * reinventing it, including the same full-field-set PUT on restore so it
 * doesn't silently wipe weeklyTarget/monthlyTarget/motivation/
 * topOutThresholdDays — the exact bug already fixed twice elsewhere this
 * phase for exactly this "optional fields are applied unconditionally on a
 * PUT" backend behavior.
 */
export default function ArchivedTowersSheet({ visible, onClose, theme }) {
  const { archivedHabits, updateHabit, deleteHabit } = useHabits();
  const { toast, showToast, hideToast } = useToast();
  const { request, confirm, respond } = useConfirm();

  const handleRestore = async (habit) => {
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
        archived: false,
      });
    } catch (err) {
      showToast(`Could not restore tower — ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  const handleDelete = async (habit) => {
    const ok = await confirm({
      title: 'Delete this tower?',
      message: `This permanently removes "${habit.name}" and every check-in on it. This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Keep it',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteHabit(habit.id);
    } catch (err) {
      showToast(`Could not delete tower — ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} testID="archived-towers-close">
            <MaterialCommunityIcons name="close" size={22} color={theme.muted} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Retired towers</Text>
          <View style={{ width: 22 }} />
        </View>

        <FlatList
          data={archivedHabits}
          keyExtractor={(h) => String(h.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: theme.muted }]}>
              No retired towers yet. Retiring a tower from its sheet moves it here.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={[styles.row, { borderBottomColor: theme.border || 'rgba(128,128,128,0.2)' }]}>
              <MaterialCommunityIcons name={categoryIcon(item.category)} size={20} color={theme.muted} style={styles.rowIcon} />
              <Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Pressable onPress={() => handleRestore(item)} style={styles.rowAction} testID={`archived-restore-${item.id}`}>
                <Text style={[styles.rowActionText, { color: theme.amber }]}>Restore</Text>
              </Pressable>
              <Pressable onPress={() => handleDelete(item)} style={styles.rowAction} testID={`archived-delete-${item.id}`}>
                <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.muted} />
              </Pressable>
            </View>
          )}
          testID="archived-towers-list"
        />

        <Toast toast={toast} onHide={hideToast} />
        <ConfirmModal request={request} onRespond={respond} />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontFamily: fonts.bold, fontSize: 17 },
  listContent: { paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 },
  empty: { fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', paddingTop: 48 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  rowIcon: { marginRight: 2 },
  rowName: { flex: 1, fontFamily: fonts.semiBold, fontSize: 15 },
  rowAction: { paddingHorizontal: 8, paddingVertical: 6 },
  rowActionText: { fontFamily: fonts.semiBold, fontSize: 14 },
});
