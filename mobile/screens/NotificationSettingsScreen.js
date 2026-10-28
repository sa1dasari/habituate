import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import StackHeader from '../components/StackHeader';
import { useAppTheme } from '../hooks/useAppTheme';
import { useNotificationSwipePrefs } from '../hooks/useNotificationSwipePrefs';
import { radii, shadow, spacing } from '../theme';

const STATUS_LABELS = {
  granted: 'Allowed',
  denied: 'Blocked',
  undetermined: 'Not asked yet',
};

const SWIPE_OPTIONS = [
  {
    key: 'outlook',
    deleteOnLeft: false,
    title: 'Mark as read on the left',
    subtitle: 'Swipe left for Mark as read, swipe right for Delete.',
    leftIcon: 'check',
    rightIcon: 'trash-can-outline',
  },
  {
    key: 'mail',
    deleteOnLeft: true,
    title: 'Delete on the left',
    subtitle: 'Swipe left for Delete, swipe right for Mark as read — like iOS Mail.',
    leftIcon: 'trash-can-outline',
    rightIcon: 'check',
  },
];

export default function NotificationSettingsScreen({ navigation }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const [status, setStatus] = useState(null);
  const { deleteOnLeft, setDeleteOnLeft, loaded: swipePrefsLoaded } = useNotificationSwipePrefs();

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

        <Text style={styles.sectionLabel}>Notification swipe actions</Text>
        <Text style={styles.sectionHint}>
          Choose which way you swipe a notification in the notification center to mark it read or delete it.
        </Text>
        {SWIPE_OPTIONS.map((option) => {
          const selected = swipePrefsLoaded && deleteOnLeft === option.deleteOnLeft;
          return (
            <Pressable
              key={option.key}
              style={[styles.swipeOption, selected && styles.swipeOptionSelected]}
              onPress={() => setDeleteOnLeft(option.deleteOnLeft)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <View style={styles.swipePreview}>
                <View style={[styles.swipeChip, { backgroundColor: colors.accent }]}>
                  <MaterialCommunityIcons name={option.leftIcon} size={14} color="#FFFFFF" />
                </View>
                <MaterialCommunityIcons name="arrow-left-right" size={14} color={colors.textMuted} />
                <View style={[styles.swipeChip, { backgroundColor: colors.atRisk }]}>
                  <MaterialCommunityIcons name={option.rightIcon} size={14} color="#FFFFFF" />
                </View>
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowLabel}>{option.title}</Text>
                <Text style={styles.rowMeta}>{option.subtitle}</Text>
              </View>
              <MaterialCommunityIcons
                name={selected ? 'radiobox-marked' : 'radiobox-blank'}
                size={20}
                color={selected ? colors.accent : colors.textMuted}
              />
            </Pressable>
          );
        })}
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
    sectionLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: spacing.xl,
      marginBottom: 2,
    },
    sectionHint: { ...typography.meta, marginBottom: spacing.md },
    swipeOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1.5,
      borderColor: 'transparent',
      ...shadow,
    },
    swipeOptionSelected: { borderColor: colors.accent },
    swipePreview: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    swipeChip: {
      width: 26,
      height: 26,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
