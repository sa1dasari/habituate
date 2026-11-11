import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import HoldPillButton from './HoldPillButton';
import { fonts } from '../theme';

/**
 * The persistent bottom sheet list below the skyline scene
 * (concept_screens/1-skyline-daily.png, CLAUDE.md section 4's screen
 * inventory — "bottom sheet list of today's towers"). Docked as part of
 * this screen's own layout, not a popup `<Modal>` — it's always visible,
 * same as the mockup shows. Also the full non-visual equivalent of the
 * skyline for a screen reader (section 13): every tower's name, run length,
 * and build action are available here as plain rows, not just as shapes.
 */
export default function SkylineHabitSheet({ habits, getCanBuild, onBuild, tapToBuild, theme }) {
  return (
    <View style={[styles.sheet, { backgroundColor: theme.surfaceLow }]}>
      <View style={[styles.handle, { backgroundColor: theme.muted }]} />
      <ScrollView contentContainerStyle={styles.list}>
        {habits.map((habit) => {
          const canBuild = getCanBuild(habit.id);
          return (
            <View key={habit.id} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: habit.color }]} />
              <View style={styles.labelWrap}>
                <Text style={[styles.name, { color: theme.text }]}>{habit.name}</Text>
                <Text style={[styles.meta, { color: theme.muted }]}>
                  {habit.currentRun} day run
                </Text>
              </View>
              <HoldPillButton
                // Already built today = can't hold again — true only for a
                // BOOLEAN habit that's checked in; COUNT habits can always
                // hold more, so they never show "Built" here.
                built={!canBuild}
                canBuild={canBuild}
                tapToBuild={tapToBuild}
                onBuild={() => onBuild(habit.id)}
                color={habit.color}
                label={habit.name}
                theme={theme}
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, opacity: 0.4 },
  list: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.2)' },
  dot: { width: 14, height: 14, borderRadius: 4, marginRight: 14 },
  labelWrap: { flex: 1 },
  name: { fontFamily: fonts.bold, fontSize: 17 },
  meta: { fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
});
