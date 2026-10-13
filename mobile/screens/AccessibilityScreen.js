import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import StackHeader from '../components/StackHeader';
import { useAppTheme } from '../hooks/useAppTheme';
import { radii, shadow, spacing } from '../theme';

// Relocated verbatim from ProfileScreen's old "Appearance" card — this is
// genuinely where it belongs. Other accessibility infra (dynamic type
// scaling, reduce-motion) doesn't exist in theme.js yet and is out of scope
// for this pass.
const MODE_OPTIONS = [
  { value: 'light', label: 'Light', icon: 'white-balance-sunny' },
  { value: 'dark', label: 'Dark', icon: 'weather-night' },
  { value: 'system', label: 'System', icon: 'theme-light-dark' },
];

export default function AccessibilityScreen({ navigation }) {
  const { colors, typography, mode, setMode } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StackHeader title="Accessibility" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Appearance</Text>
          <Text style={styles.cardNote}>System follows your phone's setting until you override it.</Text>
          <View style={styles.themeRow}>
            {MODE_OPTIONS.map((option) => {
              const active = mode === option.value;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.themePill, active && styles.themePillActive]}
                  onPress={() => setMode(option.value)}
                  accessibilityRole="button"
                  accessibilityLabel={`${option.label} appearance`}
                  accessibilityState={{ selected: active }}
                >
                  <MaterialCommunityIcons
                    name={option.icon}
                    size={18}
                    color={active ? colors.accent : colors.textSecondary}
                  />
                  <Text style={[styles.themePillText, active && styles.themePillTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
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
    cardTitle: { ...typography.cardTitle, marginBottom: spacing.xs },
    cardNote: { ...typography.meta, marginBottom: spacing.md },
    themeRow: { flexDirection: 'row', gap: spacing.sm },
    themePill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      paddingVertical: spacing.sm + 2,
      backgroundColor: colors.background,
    },
    themePillActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
    themePillText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    themePillTextActive: { color: colors.accent },
  });
}
