import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from './Toast';
import { useToast } from '../hooks/useToast';
import { api } from '../api/client';
import { classifyDays } from '../utils/skylineScene';
import { sumValueForDay } from '../utils/dayStats';
import { cadenceTarget, isCountMode } from '../utils/cadence';
import { fonts } from '../theme';

/**
 * Phase 3c's inside view (design/skyline/07-crosssection.png, SKYLINE.md
 * section 9/10's gate): "each floor is a day" — set, open and glass states,
 * replacing the old per-habit TreeRingChart/calendar. Deliberately built as
 * a flat virtualized list rather than the mockup's continuous 3D tower with
 * a drag-handle scrubber — the approved plan (precious-sleeping-scott.md
 * Part D) specifies "a cross-section list," and a list is testable without
 * a device while the scrubber's geometry isn't. Flagged as a known visual
 * gap versus the mockup, not an oversight.
 *
 * Reuses `classifyDays` from skylineScene.js — the same set/open/glass
 * classification the tower itself draws from — fed with this habit's real
 * shielded dates, fetched on demand only while this view is open (not
 * folded into useHabits.js's global refresh; see skylineAdapter.js's
 * `toSceneHabit` comment on why `shieldDays` stays a stub everywhere else).
 */
export default function TowerInsideView({ visible, onClose, habit, sceneHabit, today, uiTheme, towerTheme, onAskAboutTower }) {
  const { toast, showToast, hideToast } = useToast();
  const [shieldDays, setShieldDays] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !habit) return;
    let cancelled = false;
    // Reset before fetching so switching habits (tower A -> close -> tower
    // B, both visible transitions) never shows A's shield days while B's
    // own fetch is still in flight.
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

  const todayKey = useMemo(() => {
    const d = today || new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [today]);

  const rows = useMemo(() => {
    if (!sceneHabit) return [];
    const days = classifyDays({ ...sceneHabit, shieldDays }, todayKey);
    if (days.length === 0) return [];

    // Run-band membership (lit vs. dark windows) over the full history, not
    // just the visible/tiered window the SVG tower caps itself to for its
    // own perf budget — that cap exists for SVG shape count, which doesn't
    // apply to this plain virtualized list.
    const litIndices = new Set();
    if (sceneHabit.currentRun > 0) {
      for (let i = days.length - 1; i >= 0 && litIndices.size < sceneHabit.currentRun; i -= 1) {
        if (days[i].state !== 'set') break;
        litIndices.add(i);
      }
    }

    // A COUNT habit's day can be "open" with partial progress logged (e.g.
    // 3 of 5) — classifyDays only knows set/open/glass (it needs that
    // target reached to call a day "set", same as the tower face), so a
    // partial day would otherwise render identically to an untouched one.
    // Carrying the raw value here lets the row say "Open · 3 of 5" instead,
    // since collapsing those two into the same label would be exactly the
    // perfection framing CLAUDE.md's product rules rule out.
    const countMode = habit ? isCountMode(habit) : false;
    const target = countMode ? cadenceTarget(habit) : null;

    const newestFirst = [];
    for (let i = days.length - 1; i >= 0; i -= 1) {
      const entry = days[i];
      newestFirst.push({
        ...entry,
        lit: litIndices.has(i),
        isToday: entry.day === todayKey,
        color: sceneHabit.color,
        value: countMode ? sumValueForDay(habit, entry.day) : null,
        target,
      });
    }

    const out = [];
    let lastMonth = null;
    newestFirst.forEach((entry) => {
      const monthKey = entry.day.slice(0, 7);
      if (monthKey !== lastMonth) {
        out.push({ kind: 'header', key: `h-${monthKey}`, label: monthLabel(entry.day) });
        lastMonth = monthKey;
      }
      out.push({ kind: 'day', key: entry.day, ...entry });
    });
    return out;
  }, [sceneHabit, habit, shieldDays, todayKey]);

  if (!habit) return null;

  const handleAsk = () => {
    onClose();
    onAskAboutTower?.(habit);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: uiTheme.background }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.backBtn} testID="tower-inside-back">
            <MaterialCommunityIcons name="chevron-left" size={24} color={uiTheme.text} />
            <Text style={[styles.backLabel, { color: uiTheme.text }]} numberOfLines={1}>
              {habit.name}
            </Text>
          </Pressable>
          <Text style={[styles.headerRight, { color: uiTheme.muted }]}>Inside view</Text>
        </View>

        <Text style={[styles.subtitle, { color: uiTheme.muted }]}>Each floor is one day.</Text>

        <FlatList
          data={rows}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) =>
            item.kind === 'header' ? (
              <Text style={[styles.monthHeader, { color: uiTheme.muted }]}>{item.label}</Text>
            ) : (
              <DayRow item={item} uiTheme={uiTheme} towerTheme={towerTheme} />
            )
          }
          ListEmptyComponent={
            !loading ? (
              <Text style={[styles.empty, { color: uiTheme.muted }]}>No floors yet.</Text>
            ) : null
          }
          testID="tower-inside-list"
        />

        <Pressable
          onPress={handleAsk}
          style={[styles.askRow, { borderTopColor: uiTheme.border || 'rgba(128,128,128,0.2)' }]}
          testID="tower-inside-ask"
        >
          <MaterialCommunityIcons name="chat-processing-outline" size={20} color={uiTheme.amber || uiTheme.text} />
          <Text style={[styles.askLabel, { color: uiTheme.amber || uiTheme.text }]}>Ask about this tower</Text>
        </Pressable>

        <Toast toast={toast} onHide={hideToast} />
      </SafeAreaView>
    </Modal>
  );
}

function monthLabel(dayKey) {
  return new Date(`${dayKey}T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatDayLabel(dayKey) {
  return new Date(`${dayKey}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function DayRow({ item, uiTheme, towerTheme }) {
  const { state, lit, isToday, value, target } = item;
  const base = state === 'set' ? 'Set' : state === 'glass' ? 'Shield Day' : 'Open';
  // COUNT habits only: a 'set' day shows what was actually logged, and an
  // 'open' day with partial progress shows it too, rather than reading
  // identically to a day with nothing logged at all.
  const label =
    target != null && state === 'set'
      ? `${base} · ${value}`
      : target != null && state === 'open' && value > 0
        ? `${base} · ${value} of ${target}`
        : base;
  const swatchStyle =
    state === 'glass'
      // Glass-tinted, translucent, with a bright edge — board 22's
      // treatment, same tokens the daily Shield Day floor uses
      // (skylineScene.js). Never an opaque solid block, never a hatch.
      ? {
          backgroundColor: towerTheme.shieldFill,
          opacity: 0.45,
          borderWidth: 1.2,
          borderColor: towerTheme.shieldEdge,
        }
      : state === 'open'
        ? { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: towerTheme.openStroke }
        : { backgroundColor: item.color || towerTheme.windowLit };

  return (
    <View style={styles.dayRow} accessibilityLabel={`${formatDayLabel(item.day)}, ${label}${isToday ? ', today' : ''}`}>
      <View style={[styles.swatch, swatchStyle]}>
        {state === 'set' && (
          // Matches the tower face's own language (skylineScene.js's
          // faceShapes): wall color is identical in and out of the run
          // band — only the window lit/dark state differs. A 16px square
          // can't draw a wall-plus-window, so this pip stands in for the
          // window: lit (windowLit) inside the current run, dark
          // (windowDark) once the run has passed it.
          <View style={[styles.swatchPip, { backgroundColor: lit ? towerTheme.windowLit : towerTheme.windowDark }]} />
        )}
        {state === 'glass' && <MaterialCommunityIcons name="shield" size={10} color={towerTheme.shieldIcon} />}
      </View>
      <Text style={[styles.dayDate, { color: uiTheme.text }]}>
        {formatDayLabel(item.day)}
        {isToday ? ' · Today' : ''}
      </Text>
      <Text style={[styles.dayState, { color: uiTheme.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, gap: 2 },
  backLabel: { fontFamily: fonts.bold, fontSize: 17, marginLeft: 2 },
  headerRight: { fontFamily: fonts.semiBold, fontSize: 13 },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  listContent: { paddingHorizontal: 20, paddingBottom: 12 },
  monthHeader: { fontFamily: fonts.semiBold, fontSize: 13, paddingTop: 16, paddingBottom: 6 },
  dayRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  swatch: { width: 16, height: 16, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  swatchPip: { width: 5, height: 5, borderRadius: 1 },
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
