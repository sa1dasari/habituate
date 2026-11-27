import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import StackHeader from '../components/StackHeader';
import { useAppTheme } from '../hooks/useAppTheme';
import { useShowFinishedTowers } from '../hooks/useShowFinishedTowers';
import { useFloatingTabBar } from '../hooks/useFloatingTabBar';
import { radii, shadow, spacing } from '../theme';

/**
 * Board 57/99/100: the "Skyline" settings page, reached from the Profile
 * row (board 15). "Floating tab bar" (board 99/100, owner-approved
 * 2026-11-26) sits above "Show finished towers" — the global default
 * `useShowFinishedTowers` resolves a habit's live-skyline visibility to when
 * it has no per-habit override (board 45's edit-form toggle).
 */
export default function SkylineSettingsScreen({ navigation }) {
  const { colors, typography } = useAppTheme();
  const { showFinishedTowers, setShowFinishedTowers } = useShowFinishedTowers();
  const { floatingTabBar, setFloatingTabBar } = useFloatingTabBar();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StackHeader title="Skyline" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabelWrap}>
              <Text style={styles.cardTitle}>Floating tab bar</Text>
              <Text style={styles.cardNote}>
                The tab bar floats above your skyline with space around it. Turn off for a bar fixed to the
                bottom of the screen.
              </Text>
            </View>
            <Switch
              value={floatingTabBar}
              onValueChange={setFloatingTabBar}
              accessibilityLabel="Floating tab bar"
              accessibilityRole="switch"
              testID="skyline-settings-floating-tab-bar"
            />
          </View>
        </View>
        <View style={[styles.card, styles.cardSpacing]}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabelWrap}>
              <Text style={styles.cardTitle}>Show finished towers</Text>
              <Text style={styles.cardNote}>
                Finished towers stay on your skyline, faded behind the current one. Turn this off to see only
                current towers.
              </Text>
            </View>
            <Switch
              value={showFinishedTowers}
              onValueChange={setShowFinishedTowers}
              accessibilityLabel="Show finished towers"
              accessibilityRole="switch"
              testID="skyline-settings-show-finished-towers"
            />
          </View>
        </View>
        <Text style={styles.footnote}>
          You can still open finished towers from the Retired and finished list. You can also change this for
          one habit in its Edit screen.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors, typography) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    container: { padding: spacing.lg, paddingBottom: spacing.xxl },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      ...shadow,
    },
    cardSpacing: { marginTop: spacing.md },
    cardTitle: { ...typography.cardTitle, marginBottom: spacing.xs },
    cardNote: { ...typography.meta },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    switchLabelWrap: { flex: 1 },
    footnote: { ...typography.meta, marginTop: spacing.lg },
  });
}
