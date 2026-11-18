import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SectionList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from './Toast';
import ConfirmModal from './ConfirmModal';
import FinishedTowerSheet from './FinishedTowerSheet';
import { useToast } from '../hooks/useToast';
import { useConfirm } from '../hooks/useConfirm';
import { useHabits } from '../hooks/useHabits';
import MonumentSheet from './MonumentSheet';
import { restorePayload } from '../utils/monument';
import { categoryIcon } from '../constants/habitCategories';
import api from '../api/client';
import { fonts } from '../theme';

/**
 * Phase 4 Part I, extended for board 58: the Skyline-reachable combined list
 * of every finished tower (a closed segment of a still-active habit) and
 * every retired tower (a grey monument). SKYLINE.md section 14 decision 9
 * confirmed the old app allows restoring an archived habit, so this screen
 * has to too, or Phase 4's "no capability lost" gate isn't met. Opened from
 * a header icon on SkylineScreen.js; mirrors HabitsScreen.js's
 * archived-section logic (`restore`/`confirmDelete`, HabitsScreen.js:
 * 507-513/490-505) rather than reinventing it, including the same
 * full-field-set PUT on restore so it doesn't silently wipe
 * weeklyTarget/monthlyTarget/motivation/topOutThresholdDays — the exact bug
 * already fixed twice elsewhere this phase for exactly this "optional
 * fields are applied unconditionally on a PUT" backend behavior.
 *
 * Finished towers are read-only here (the habit is already active, there's
 * nothing to restore) and come from GET /habits/finished-towers, fetched
 * fresh each time the sheet opens — the same pattern MonumentSheet already
 * uses for a retired habit's check-ins.
 */
export default function ArchivedTowersSheet({ visible, onClose, theme, towerTheme, effectiveMode, categoryColors }) {
  const { archivedHabits, updateHabit, deleteHabit } = useHabits();
  const [monumentHabitId, setMonumentHabitId] = useState(null);
  const monumentHabit = monumentHabitId ? archivedHabits.find((h) => h.id === monumentHabitId) || null : null;
  const [finishedTowers, setFinishedTowers] = useState(null);
  const [finishedRow, setFinishedRow] = useState(null);
  const { toast, showToast, hideToast } = useToast();
  const { request, confirm, respond } = useConfirm();

  useEffect(() => {
    if (!visible) return undefined;
    let cancelled = false;
    setFinishedTowers(null);
    api
      .listFinishedTowers()
      .then((list) => {
        if (!cancelled) setFinishedTowers(list || []);
      })
      .catch(() => {
        if (!cancelled) setFinishedTowers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  // Shared by the row's Restore text and the monument sheet's Restore button
  // (same full-field PUT, see utils/monument.js). Throws on failure; each
  // caller toasts in its own surface, since a Modal hides the other's toast.
  const handleRestore = (habit) => updateHabit(habit.id, restorePayload(habit));
  const restoreFromRow = async (habit) => {
    try {
      await handleRestore(habit);
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
          <Pressable
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: theme.surfaceHigh }]}
            testID="archived-towers-close"
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <MaterialCommunityIcons name="close" size={22} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Towers</Text>
          <View style={styles.closeBtn} />
        </View>

        <SectionList
          sections={[
            { key: 'finished', title: 'Finished towers', data: finishedTowers === null ? [] : finishedTowers },
            { key: 'retired', title: 'Retired towers', data: archivedHabits },
          ]}
          keyExtractor={(item, index) =>
            item.segmentId !== undefined ? `finished-${item.segmentId}` : `retired-${item.id ?? index}`
          }
          contentContainerStyle={styles.listContent}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.sectionTitle, { color: theme.muted }]}>{section.title}</Text>
          )}
          renderSectionFooter={({ section }) => {
            if (section.key === 'finished' && finishedTowers === null) {
              return <ActivityIndicator color={theme.muted} style={styles.sectionLoading} />;
            }
            if (section.key === 'finished' && finishedTowers && finishedTowers.length === 0) {
              return (
                <Text style={[styles.empty, { color: theme.muted }]}>
                  No finished towers yet. Topping out a tower leaves one behind, faded, on your skyline.
                </Text>
              );
            }
            if (section.key === 'retired' && archivedHabits.length === 0) {
              return (
                <Text style={[styles.empty, { color: theme.muted }]}>
                  No retired towers yet. Retiring a tower from its sheet moves it here.
                </Text>
              );
            }
            return null;
          }}
          renderItem={({ item, section }) =>
            section.key === 'finished' ? (
              <Pressable
                onPress={() => setFinishedRow(item)}
                style={[styles.row, { borderBottomColor: theme.border || 'rgba(128,128,128,0.2)' }]}
                testID={`finished-tower-open-${item.segmentId}`}
                accessibilityRole="button"
                accessibilityLabel={`${item.habitName}, finished tower. Open details`}
              >
                <View style={[styles.iconTile, { backgroundColor: theme.surfaceHigh }]}>
                  <MaterialCommunityIcons name={categoryIcon(item.category)} size={22} color={theme.muted} />
                </View>
                <Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>
                  {item.habitName}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={theme.muted} />
              </Pressable>
            ) : (
              <View style={[styles.row, { borderBottomColor: theme.border || 'rgba(128,128,128,0.2)' }]}>
                <Pressable
                  onPress={() => setMonumentHabitId(item.id)}
                  style={styles.rowMain}
                  testID={`archived-open-${item.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}, retired tower. Open details`}
                >
                  <View style={[styles.iconTile, { backgroundColor: theme.surfaceHigh }]}>
                    <MaterialCommunityIcons name={categoryIcon(item.category)} size={22} color={theme.muted} />
                  </View>
                  <Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => restoreFromRow(item)}
                  style={styles.rowAction}
                  testID={`archived-restore-${item.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Restore ${item.name}`}
                >
                  <Text style={[styles.rowActionText, { color: theme.amber }]}>Restore</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleDelete(item)}
                  style={styles.rowAction}
                  testID={`archived-delete-${item.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${item.name}`}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={22} color={theme.muted} />
                </Pressable>
              </View>
            )
          }
          ListFooterComponent={
            archivedHabits.length > 0 ? (
              <Text style={[styles.footnote, { color: theme.muted }]}>
                Retired towers stay on your skyline as grey monuments. Restore one to build on it again.
              </Text>
            ) : null
          }
          testID="archived-towers-list"
        />

        <MonumentSheet
          visible={!!monumentHabit}
          habit={monumentHabit}
          onClose={() => setMonumentHabitId(null)}
          onRestore={handleRestore}
          theme={theme}
          towerTheme={towerTheme}
          categoryColors={categoryColors}
        />
        <FinishedTowerSheet
          visible={!!finishedRow}
          row={finishedRow}
          onClose={() => setFinishedRow(null)}
          theme={theme}
          mode={effectiveMode}
          categoryColors={categoryColors}
        />
        <Toast toast={toast} onHide={hideToast} />
        <ConfirmModal request={request} onRespond={respond} />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  headerTitle: { fontFamily: fonts.bold, fontSize: 20 },
  closeBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', marginTop: 20, marginBottom: 8 },
  sectionLoading: { marginVertical: 16 },
  empty: { fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  iconTile: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  rowName: { flex: 1, fontFamily: fonts.semiBold, fontSize: 18 },
  rowAction: { minHeight: 44, minWidth: 44, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  rowActionText: { fontFamily: fonts.bold, fontSize: 17 },
  footnote: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, marginTop: 18 },
});
