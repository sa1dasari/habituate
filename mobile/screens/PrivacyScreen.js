import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import StackHeader from '../components/StackHeader';
import Toast from '../components/Toast';
import { useAppTheme } from '../hooks/useAppTheme';
import { useHabits } from '../hooks/useHabits';
import { useGoals } from '../hooks/useGoals';
import { useToast } from '../hooks/useToast';
import { buildExportData, shareExport, toCsv, toJson } from '../utils/dataExport';
import api from '../api/client';
import { radii, shadow, spacing } from '../theme';

// TODO: replace with the real hosted privacy policy URL before store submission.
const PRIVACY_POLICY_URL = 'https://habituate.app/privacy';

export default function PrivacyScreen({ navigation }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { habits } = useHabits();
  const { goals } = useGoals();
  const { toast, showToast, hideToast } = useToast();
  const [exporting, setExporting] = useState(null); // 'json' | 'csv' | null

  // Defaults to PRIVATE (same as every account, new or existing — see User.java) until the
  // real value loads, so the switch never flashes as "public" for a split second.
  const [profileVisibility, setProfileVisibility] = useState('PRIVATE');
  const [visibilityLoading, setVisibilityLoading] = useState(true);
  const [visibilitySaving, setVisibilitySaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getUserProfile()
      .then((profile) => {
        if (!cancelled && profile?.profileVisibility) setProfileVisibility(profile.profileVisibility);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setVisibilityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isPublic = profileVisibility === 'PUBLIC';

  const handleToggleVisibility = async (nextPublic) => {
    const next = nextPublic ? 'PUBLIC' : 'PRIVATE';
    const previous = profileVisibility;
    setProfileVisibility(next); // optimistic — flipped back on failure
    setVisibilitySaving(true);
    try {
      await api.updateProfileVisibility(next);
    } catch (err) {
      setProfileVisibility(previous);
      showToast(err instanceof Error ? err.message : "Couldn't update that — something went wrong.", 'error');
    } finally {
      setVisibilitySaving(false);
    }
  };

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
      showToast(err instanceof Error ? err.message : "Couldn't export — something went wrong.", 'error');
    } finally {
      setExporting(null);
    }
  };

  const handleOpenPolicy = () => {
    Linking.openURL(PRIVACY_POLICY_URL).catch(() => {
      showToast("Couldn't open that — try again in a moment.", 'error');
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

        <Text style={styles.sectionTitle}>Friend profile</Text>
        <Text style={styles.cardNote}>
          Controls what a friend sees when they tap your name or photo. Private is the default for every account.
        </Text>
        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <MaterialCommunityIcons name={isPublic ? 'earth' : 'lock-outline'} size={18} color={colors.accent} />
          </View>
          <View style={styles.optionText}>
            <Text style={styles.rowLabel}>{isPublic ? 'Public profile' : 'Private profile'}</Text>
            <Text style={styles.optionHint}>
              {isPublic
                ? 'Friends see your aggregate streak & consistency stats, plus shared-habit streaks.'
                : 'Friends see only your name, username, and avatar, plus any shared-habit streak with you.'}
            </Text>
          </View>
          {visibilityLoading ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <Switch
              value={isPublic}
              onValueChange={handleToggleVisibility}
              disabled={visibilitySaving}
              trackColor={{ false: colors.border, true: colors.accentSoft }}
              thumbColor={isPublic ? colors.accent : '#FFFFFF'}
            />
          )}
        </View>

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
      <Toast toast={toast} onHide={hideToast} />
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
    optionText: { flex: 1 },
    optionHint: { ...typography.meta, marginTop: 2 },
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
