import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TOWER_COLOR_PALETTE } from '../constants/towerColors';
import { fonts } from '../theme';

/**
 * "Tower color" swatch grid (design-review boards 12 / 45). 12 circular
 * swatches, 6 per row, 44dp tap targets; the selected one gets a white ring.
 * `value` is a palette key or null (no pick = category colour, nothing
 * selected). Tapping the selected swatch again keeps it selected.
 *
 * @param {string|null} value - palette key from constants/towerColors.js
 * @param {(key: string) => void} onChange
 * @param {object} theme - skylineUI[mode] (text / muted)
 * @param {'dark'|'light'} mode - picks each swatch's hex
 */
export default function TowerColorPicker({ value = null, onChange, theme, mode = 'dark' }) {
  const styles = useMemo(() => makeStyles(), []);
  return (
    <View testID="tower-color-picker">
      <Text style={[styles.label, { color: theme?.text }]}>Tower color</Text>
      <View style={styles.grid} accessibilityRole="radiogroup">
        {TOWER_COLOR_PALETTE.map((c) => {
          const selected = value === c.key;
          return (
            <Pressable
              key={c.key}
              testID={`tower-color-${c.key}`}
              accessibilityRole="radio"
              accessibilityLabel={`${c.label}, ${selected ? 'selected' : 'not selected'}`}
              accessibilityState={{ selected }}
              onPress={() => onChange && onChange(c.key)}
              style={styles.cell}
            >
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: mode === 'light' ? c.light : c.dark },
                  selected && styles.swatchSelected,
                  // White ring on dark; on light it would vanish, so use the ink colour.
                  selected && mode === 'light' && { borderColor: theme?.text || '#15202B' },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.hint, { color: theme?.muted }]}>Used for this tower on your skyline and in Insights.</Text>
    </View>
  );
}

function makeStyles() {
  return StyleSheet.create({
    label: { fontFamily: fonts.bold, fontSize: 14, marginBottom: 8 },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    // 6 per row: each cell is 1/6 of the width, min 44dp tall hit area.
    cell: { width: '16.666%', minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: 'transparent' },
    swatchSelected: { borderColor: '#FFFFFF', transform: [{ scale: 1.1 }] },
    hint: { fontFamily: fonts.regular, fontSize: 12, marginTop: 6 },
  });
}
