import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import StackHeader from '../components/StackHeader';
import { useAppTheme } from '../hooks/useAppTheme';
import { fonts, radii, shadow, spacing } from '../theme';

/**
 * New for board 15's "Sky and weather" Profile row — SKYLINE.md section 14
 * item 2/5 never had a dedicated screen; the only location UI before this was
 * the one-time LocationPermissionModal explainer fired from SkylineScreen
 * after the first floor. Status is read live from expo-location on every
 * focus (not cached in useWeatherSky, which only tracks whether the one-time
 * prompt banner has been shown/skipped, a different concern). Once denied,
 * iOS/Android won't let the app re-prompt — Linking.openSettings() is the
 * only way back, same convention every OS uses for a blocked permission.
 */
export default function SkyWeatherSettingsScreen({ navigation }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const [status, setStatus] = useState(null); // Location.PermissionStatus | null while checking

  const checkStatus = useCallback(() => {
    Location.getForegroundPermissionsAsync()
      .then(({ status: s }) => setStatus(s))
      .catch(() => setStatus(Location.PermissionStatus.UNDETERMINED));
  }, []);

  // Re-check on every focus, not just mount — covers the user granting or
  // revoking location in OS Settings and coming straight back to this screen.
  useFocusEffect(
    useCallback(() => {
      checkStatus();
    }, [checkStatus]),
  );

  const granted = status === Location.PermissionStatus.GRANTED;
  const denied = status === Location.PermissionStatus.DENIED;

  const handleAllow = async () => {
    const { status: s, canAskAgain } = await Location.requestForegroundPermissionsAsync();
    if (s === Location.PermissionStatus.GRANTED || !canAskAgain) {
      setStatus(s);
    }
    if (s !== Location.PermissionStatus.GRANTED && !canAskAgain) {
      // Already denied once — the OS won't show its own dialog again.
      Linking.openSettings().catch(() => {});
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StackHeader title="Sky and weather" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <View style={[styles.iconTile, { backgroundColor: 'rgba(124,196,245,0.18)' }]}>
              <MaterialCommunityIcons name="weather-partly-cloudy" size={22} color="#7CC4F5" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Approximate location</Text>
              <Text style={styles.statusValue}>{granted ? 'On' : 'Off'}</Text>
            </View>
          </View>
          <Text style={styles.cardNote}>
            With your approximate location, your skyline's sky can show real clouds, rain or snow — not
            just the clock. It's never shown precisely, never shared, and stays on this device. Without
            it, the sky still follows the time of day.
          </Text>
          {!granted ? (
            <Pressable
              style={styles.allowBtn}
              onPress={handleAllow}
              accessibilityRole="button"
              accessibilityLabel={denied ? 'Open Settings to allow location' : 'Allow location'}
            >
              <Text style={styles.allowText}>{denied ? 'Open Settings' : 'Allow location'}</Text>
            </Pressable>
          ) : null}
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
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
    iconTile: {
      width: 44,
      height: 44,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: { ...typography.cardTitle },
    statusValue: { ...typography.meta, marginTop: 2 },
    cardNote: { ...typography.meta, marginBottom: spacing.lg },
    allowBtn: {
      minHeight: 48,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
    },
    allowText: { fontFamily: fonts.bold, fontSize: 15, color: '#1A1300' },
  });
}
