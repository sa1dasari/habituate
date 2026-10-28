import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import StackHeader from '../components/StackHeader';
import EditProfileModal from '../components/EditProfileModal';
import { useAppTheme } from '../hooks/useAppTheme';
import { useReplayTour } from '../hooks/useOnboardingTour';
import { radii, shadow, spacing } from '../theme';

const ROWS = [
  { key: 'personalInfo', icon: 'account-outline', label: 'Personal Info' },
  { key: 'LoginSecurity', icon: 'shield-lock-outline', label: 'Login & Security' },
  { key: 'Privacy', icon: 'lock-outline', label: 'Privacy' },
  { key: 'NotificationSettings', icon: 'bell-outline', label: 'Notifications' },
  { key: 'Accessibility', icon: 'theme-light-dark', label: 'Accessibility' },
  // Replays the first-time-user onboarding tour from the start — re-usable
  // any time, not just on a fresh account (see useOnboardingTour.js).
  { key: 'replayTour', icon: 'compass-outline', label: 'Replay tour' },
  { key: 'GetHelp', icon: 'help-circle-outline', label: 'Get Help' },
  { key: 'ReportBug', icon: 'bug-outline', label: 'Report a Bug / Suggestion' },
];

export default function AccountSettingsScreen({ navigation }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const [editVisible, setEditVisible] = useState(false);
  const replayTour = useReplayTour();

  const handlePress = (key) => {
    if (key === 'personalInfo') {
      setEditVisible(true);
      return;
    }
    if (key === 'replayTour') {
      // Starting the tour already switches to the Today tab itself (its
      // first step's own `tab` field, via the shared navigationRef) — no
      // manual navigation needed from this nested stack.
      replayTour();
      return;
    }
    navigation.navigate(key);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StackHeader title="Account Settings" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          {ROWS.map((row, index) => (
            <Pressable
              key={row.key}
              style={[styles.row, index === ROWS.length - 1 && styles.rowLast]}
              onPress={() => handlePress(row.key)}
              accessibilityRole="button"
              accessibilityLabel={row.label}
            >
              <View style={styles.rowIcon}>
                <MaterialCommunityIcons name={row.icon} size={18} color={colors.accent} />
              </View>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <EditProfileModal visible={editVisible} onClose={() => setEditVisible(false)} />
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
      ...shadow,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowLast: { borderBottomWidth: 0 },
    rowIcon: {
      width: 32,
      height: 32,
      borderRadius: radii.md,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  });
}
