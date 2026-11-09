import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HABIT_CATEGORY_COLORS } from '../../constants/habitCategories';
import { buildCategoryTowerColors, skyGradients, skylineTowerTheme, skylineUI } from '../../theme';
import { SKYLINE_FIXTURE_HABITS, FIXTURE_TODAY } from '../../utils/__fixtures__/skylineFixtures';
import { SKY_KINDS } from '../../utils/sky';
import { buildScene } from '../../utils/skylineScene';
import { useWindowCount } from '../../hooks/useWindowCount';
import SkylineView from '../../components/SkylineView';

/**
 * Phase 1 gate screen (SKYLINE.md section 11): renders a sample skyline from
 * fixtures in both light and dark, across every sky kind, so the engine and
 * palettes can be checked on-device before Phase 2 wires it to real habit
 * data. __DEV__-gated entry point in App.js, replacing the Phase 0 spike
 * tab (its renderer question is answered — see SKYLINE.md Phase 0 notes).
 */

const towerColors = buildCategoryTowerColors(HABIT_CATEGORY_COLORS);

export default function SkylineEngineScreen() {
  const [mode, setMode] = useState('dark');
  const [sky, setSky] = useState('day');
  const { windowCount } = useWindowCount();

  const ui = skylineUI[mode];
  const towerTheme = skylineTowerTheme[mode];
  const skyStops = skyGradients[mode][sky];
  const categoryColors = towerColors[mode];

  const habits = useMemo(
    () => SKYLINE_FIXTURE_HABITS.map((h) => ({ ...h, color: categoryColors[h.category] || categoryColors.Other })),
    [categoryColors],
  );
  const scene = useMemo(
    () => buildScene(habits, { today: FIXTURE_TODAY, theme: towerTheme, windowCount }),
    [habits, towerTheme, windowCount],
  );

  return (
    <View style={[styles.root, { backgroundColor: ui.background }]}>
      <Text style={[styles.title, { color: ui.text }]}>Skyline engine (Phase 1, dev only)</Text>
      <Text style={[styles.body, { color: ui.muted }]}>
        Fixture skyline — Run (active), Gym (weekly-target), Write (topped out), Meditate
        (monument), Sleep by 11 (90 days old, tier-collapsed).
      </Text>

      <View style={styles.row}>
        {['dark', 'light'].map((m) => (
          <Pressable
            key={m}
            style={[styles.chip, { backgroundColor: ui.surfaceHigh }, mode === m && { borderColor: ui.amber, borderWidth: 2 }]}
            onPress={() => setMode(m)}
          >
            <Text style={[styles.chipText, { color: ui.text }]}>{m}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
        {SKY_KINDS.map((k) => (
          <Pressable
            key={k}
            style={[styles.chip, { backgroundColor: ui.surfaceHigh }, sky === k && { borderColor: ui.amber, borderWidth: 2 }]}
            onPress={() => setSky(k)}
          >
            <Text style={[styles.chipText, { color: ui.text }]}>{k}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <SkylineView habits={habits} scene={scene} skyStops={skyStops} containerWidth={390} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 50, paddingHorizontal: 16 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  body: { fontSize: 13, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8 },
  chipText: { fontSize: 12 },
});
