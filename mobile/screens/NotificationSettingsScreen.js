import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import StackHeader from '../components/StackHeader';
import { useAppTheme } from '../hooks/useAppTheme';
import { radii, shadow, spacing } from '../theme';

const STATUS_LABELS = {
  granted: 'Allowed',
  denied: 'Blocked',
  undetermined: 'Not asked yet',
};

export default function NotificationSettingsScreen({ navigation }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const Notifications = await import('expo-notifications');
        const result = await Notifications.getPermissionsAsync();
        if (!cancelled) setStatus(result.status);
      } catch {
        if (!cancelled) setStatus('undetermined');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StackHeader title="Notifications" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <MaterialCommunityIcons name="bell-outline" size={18} color={colors.accent} />
          </View>
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel}>Push notifications</Text>
            <Text style={styles.rowMeta}>
              {status === null ? '' : STATUS_LABELS[status] || status}
            </Text>
          </View>
          {status === null ? <ActivityIndicator size="small" color={colors.accent} /> : null}
        </View>

        <Pressable style={styles.secondaryButton} onPress={() => Linking.openSettings()}>
          <MaterialCommunityIcons name="cog-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.secondaryButtonText}>Open notification settings</Text>
        </Pressable>

        <Text style={styles.note}>
          Reminders are set per-habit — open any habit's settings to turn its reminder on or off.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors, typography) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    container: { padding: spacing.lg, paddingBottom: spacing.xxl },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      marginBottom: spacing.lg,
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
    rowInfo: { flex: 1 },
    rowLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
    rowMeta: { ...typography.meta, marginTop: 1 },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: colors.surface,
      borderRadius: radii.pill,
      paddingVertical: spacing.sm + 2,
      ...shadow,
    },
    secondaryButtonText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
    note: { ...typography.meta, marginTop: spacing.lg },
  });
}
