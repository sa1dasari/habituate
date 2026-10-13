import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import StackHeader from '../components/StackHeader';
import { useAppTheme } from '../hooks/useAppTheme';
import { useHabits } from '../hooks/useHabits';
import { useGoals } from '../hooks/useGoals';
import { buildExportData, shareExport, toCsv, toJson } from '../utils/dataExport';
import { radii, shadow, spacing } from '../theme';

// TODO: replace with the real hosted privacy policy URL before store submission.
const PRIVACY_POLICY_URL = 'https://habituate.app/privacy';

export default function PrivacyScreen({ navigation }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { habits } = useHabits();
  const { goals } = useGoals();
  const [exporting, setExporting] = useState(null); // 'json' | 'csv' | null

  const handleExport = async (format) => {
    setExporting(format);
    try {
      const data = buildExportData(habits, goals);
      if (format === 'json') {
        await shareExport(toJson(data), 'habituate-export.json', 'application/json');
      } else {
        await shareExport(toCsv(data), 'habituate-checkins.csv', 'text/csv');
      }
    } catch (err) {
      Alert.alert("Couldn't export", err instanceof Error ? err.message : 'Something went wrong — try again.');
    } finally {
      setExporting(null);
    }
  };

  const handleOpenPolicy = () => {
    Linking.openURL(PRIVACY_POLICY_URL).catch(() => {
      Alert.alert("Couldn't open that", 'Try again in a moment.');
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StackHeader title="Privacy" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.note}>
          Habituate only uses your data to power your own habits, streaks, and the AI coach — never sold or
          shared with advertisers.
        </Text>

        <Pressable style={styles.row} onPress={handleOpenPolicy}>
          <View style={styles.rowIcon}>
            <MaterialCommunityIcons name="file-document-outline" size={18} color={colors.accent} />
          </View>
          <Text style={styles.rowLabel}>Privacy Policy</Text>
          <MaterialCommunityIcons name="open-in-new" size={18} color={colors.textMuted} />
        </Pressable>

        <Text style={styles.sectionTitle}>Your data</Text>
        <Text style={styles.cardNote}>A copy of your habits, check-ins, and goals — yours to keep.</Text>
        <View style={styles.exportRow}>
          <Pressable style={styles.secondaryButton} disabled={!!exporting} onPress={() => handleExport('json')}>
            {exporting === 'json' ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : (
              <MaterialCommunityIcons name="code-json" size={16} color={colors.textSecondary} />
            )}
            <Text style={styles.secondaryButtonText}>Export JSON</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} disabled={!!exporting} onPress={() => handleExport('csv')}>
            {exporting === 'csv' ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : (
              <MaterialCommunityIcons name="table" size={16} color={colors.textSecondary} />
            )}
            <Text style={styles.secondaryButtonText}>Export CSV</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors, typography) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    container: { padding: spacing.lg, paddingBottom: spacing.xxl },
    note: { ...typography.meta, marginBottom: spacing.lg },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      ...shadow,
    },
    rowIcon: {
      width: 32,
      height: 32,
      borderRadius: radii.md,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
    sectionTitle: { ...typography.sectionTitle, marginTop: spacing.xl, marginBottom: spacing.xs },
    cardNote: { ...typography.meta, marginBottom: spacing.md },
    exportRow: { flexDirection: 'row', gap: spacing.sm },
    secondaryButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      paddingVertical: spacing.sm + 2,
      backgroundColor: colors.surface,
    },
    secondaryButtonText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  });
}
