import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg from 'react-native-svg';
import SkylineTower from './SkylineTower';
import Toast from './Toast';
import { useToast } from '../hooks/useToast';
import api from '../api/client';
import { buildMonument } from '../utils/monument';
import { buildScene, X0, BASE_Y, TOWER_W, DX, CRANE_HEIGHT, FLOOR_H } from '../utils/skylineScene';
import { fonts } from '../theme';

const MINI_MAX_W = 100;
const MINI_MAX_H = 150;

function startedLabel(createdAt) {
  if (!createdAt) return '-';
  return new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Bottom sheet for a retired tower (design board 51): its grey monument, three
 * stats (Total built, Best run, Started - no retire date, the owner chose to
 * leave it out) and a Restore button. `onRestore(habit)` does the actual PUT
 * and may throw; the failure is toasted here, inside this Modal. Retired habits arrive without
 * check-ins, so they're fetched here when the sheet opens - until then (or if
 * that fails) the stat reads "-" rather than a made-up number.
 */
export default function MonumentSheet({ visible, habit, onClose, onRestore, theme, towerTheme, categoryColors }) {
  const [checkIns, setCheckIns] = useState(null);
  const [busy, setBusy] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  useEffect(() => {
    if (!visible || !habit) return undefined;
    let cancelled = false;
    setCheckIns(null);
    api
      .listCheckIns(habit.id)
      .then((list) => {
        if (!cancelled) setCheckIns(list || []);
      })
      .catch(() => {
        if (!cancelled) setCheckIns([]);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, habit]);

  const monument = useMemo(
    () => (habit && checkIns && categoryColors ? buildMonument(habit, checkIns, categoryColors) : null),
    [habit, checkIns, categoryColors],
  );
  const miniScene = useMemo(
    () => (monument && towerTheme ? buildScene([monument.sceneHabit], { today: monument.endDate, theme: towerTheme }) : null),
    [monument, towerTheme],
  );

  if (!habit) return null;

  const hit = miniScene?.hitTargets?.[0];
  const box = hit
    ? { x: hit.x - 6, y: hit.y - 6, width: hit.width + 12, height: hit.height + 12 }
    : { x: X0 - 6, y: BASE_Y - FLOOR_H - CRANE_HEIGHT - 12, width: TOWER_W + DX + 12, height: FLOOR_H + CRANE_HEIGHT + 24 };
  const naturalH = MINI_MAX_W * (box.height / box.width);
  const size =
    naturalH <= MINI_MAX_H
      ? { width: MINI_MAX_W, height: naturalH }
      : { width: MINI_MAX_H * (box.width / box.height), height: MINI_MAX_H };

  const bestRun = habit.longestStreak || 0;
  const stats = [
    { key: 'total', value: monument ? String(monument.totalBuilt) : '-', label: 'Total built' },
    { key: 'best', value: `${bestRun} ${bestRun === 1 ? 'day' : 'days'}`, label: 'Best run' },
    { key: 'started', value: startedLabel(habit.createdAt), label: 'Started' },
  ];

  const handleRestore = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onRestore(habit);
      onClose();
    } catch (err) {
      // Stay open so Restore can be retried.
      showToast(`Could not restore tower — ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="monument-sheet-backdrop">
        <Pressable style={[styles.sheet, { backgroundColor: theme.surfaceHigh }]} onPress={() => {}} testID="monument-sheet">
          <View style={[styles.handle, { backgroundColor: theme.muted }]} />
          <Text style={[styles.eyebrow, { color: theme.muted }]}>RETIRED TOWER</Text>

          <View style={styles.hero}>
            <View style={{ width: size.width, height: size.height, alignItems: 'center', justifyContent: 'center' }}>
              {miniScene ? (
                <Svg
                  width={size.width}
                  height={size.height}
                  viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <SkylineTower shapes={miniScene.shapes} />
                </Svg>
              ) : (
                <ActivityIndicator color={theme.muted} />
              )}
            </View>
            <View style={styles.heroText}>
              <Text style={[styles.title, { color: theme.text }]} testID="monument-sheet-title">
                {habit.name}
              </Text>
              <Text style={[styles.meta, { color: theme.muted }]}>Daily · retired · a grey monument on your skyline</Text>
            </View>
          </View>

          <View style={styles.stats}>
            {stats.map((s) => (
              <View
                key={s.key}
                style={[styles.stat, { backgroundColor: theme.surfaceLow }]}
                testID={`monument-stat-${s.key}`}
                accessible
                accessibilityLabel={`${s.label}: ${s.value}`}
              >
                <Text style={[styles.statValue, { color: theme.text }]} numberOfLines={1}>
                  {s.value}
                </Text>
                <Text style={[styles.statLabel, { color: theme.muted }]}>{s.label}</Text>
              </View>
            ))}
          </View>

          <Pressable
            onPress={handleRestore}
            disabled={busy}
            style={[styles.restore, { backgroundColor: theme.amber, opacity: busy ? 0.6 : 1 }]}
            testID="monument-restore"
            accessibilityRole="button"
            accessibilityLabel={`Restore ${habit.name}`}
          >
            <Text style={styles.restoreText}>Restore tower</Text>
          </Pressable>
          <Text style={[styles.note, { color: theme.muted }]}>Restoring lets you build on this tower again.</Text>
        </Pressable>
      </Pressable>
      <Toast toast={toast} onHide={hideToast} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(4, 7, 18, 0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 18 },
  eyebrow: { fontFamily: fonts.bold, fontSize: 13, letterSpacing: 1.4 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 14, marginBottom: 18 },
  heroText: { flex: 1 },
  title: { fontFamily: fonts.extraBold, fontSize: 26, lineHeight: 32 },
  meta: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, marginTop: 6 },
  stats: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  stat: { flex: 1, minHeight: 68, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 10 },
  statValue: { fontFamily: fonts.extraBold, fontSize: 20 },
  statLabel: { fontFamily: fonts.regular, fontSize: 14, marginTop: 2 },
  restore: { minHeight: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  restoreText: { fontFamily: fonts.bold, fontSize: 18, color: '#1A1300' },
  note: { fontFamily: fonts.regular, fontSize: 15, textAlign: 'center', marginTop: 12 },
});
