import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts } from '../theme';

/**
 * First-hold hint (design-review board 36): shown over the real skyline
 * while the user has a tower but has never built a floor. The text never
 * takes touches (pointerEvents none), so the real hold gesture on the tower
 * underneath is what teaches the interaction. It disappears by itself the
 * moment the first floor exists — no stored flag.
 */
export default function FirstHoldHint({ theme }) {
  return (
    <View pointerEvents="none" style={styles.top} testID="first-hold-hint">
      <Text style={[styles.title, { color: theme.text }]}>Build your first floor</Text>
      <Text style={[styles.body, { color: theme.muted }]}>
        Press and hold the top of your tower for about a second. Let go early and nothing is built.
      </Text>
      <Text style={[styles.note, { color: theme.muted }]}>
        Prefer a quick tap? Turn on Tap to build in Profile, Accessibility.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', top: 8, left: 20, right: 20, gap: 8 },
  title: { fontFamily: fonts.extraBold, fontSize: 26 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  note: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, marginTop: 6 },
});
