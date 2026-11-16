import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fonts } from '../theme';

const LOT_COUNT = 3;

/**
 * First-run empty skyline (design-review board 34): the sky shows through
 * with three empty lots, and a card below invites the first foundation. Only
 * rendered when the user has no habits at all — the usual skyline replaces it
 * the moment the first tower exists.
 */
export default function FirstRunEmptyState({ onLayFoundation, theme }) {
  return (
    <View style={styles.root} testID="first-run-empty-state">
      <View style={styles.lotsArea}>
        <View style={styles.lotsRow}>
          {Array.from({ length: LOT_COUNT }).map((_, i) => (
            <Pressable
              key={i}
              onPress={onLayFoundation}
              style={styles.lot}
              testID={`first-run-lot-${i}`}
              accessibilityRole="button"
              accessibilityLabel="Empty lot, lay a foundation"
            >
              <View style={styles.plusCircle}>
                <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
              </View>
              <Svg width={96} height={26} viewBox="0 0 96 26">
                <Path
                  d="M8,22 L22,6 L92,6 L78,22 Z"
                  fill="none"
                  stroke="rgba(190,198,230,0.65)"
                  strokeWidth={1.5}
                  strokeDasharray="5,4"
                />
              </Svg>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.surfaceLow }]}>
        <View style={[styles.handle, { backgroundColor: theme.muted }]} />
        <Text style={[styles.cardTitle, { color: theme.text }]}>Lay your first foundation</Text>
        <Text style={[styles.cardBody, { color: theme.muted }]}>
          Tap an empty lot to start a tower. Each time you build a floor, it grows.
        </Text>
        <Pressable
          onPress={onLayFoundation}
          style={[styles.cta, { backgroundColor: theme.amber }]}
          testID="first-run-lay-foundation"
          accessibilityRole="button"
          accessibilityLabel="Lay a foundation"
        >
          <Text style={styles.ctaText}>Lay a foundation</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  lotsArea: { flex: 1, justifyContent: 'flex-end', paddingBottom: 24 },
  lotsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 12 },
  lot: { alignItems: 'center', minWidth: 96, minHeight: 88 },
  plusCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  card: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 18 },
  cardTitle: { fontFamily: fonts.extraBold, fontSize: 24 },
  cardBody: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, marginTop: 8 },
  cta: { marginTop: 18, minHeight: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: fonts.bold, fontSize: 18, color: '#1A1300' },
});
