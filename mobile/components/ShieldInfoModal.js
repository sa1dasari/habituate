import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../api/client';
import { useAppTheme } from '../hooks/useAppTheme';
import { radii, shadow, spacing } from '../theme';

const RULES = [
  {
    icon: 'calendar-check-outline',
    title: 'Earning a Shield',
    body: 'Every time any habit\'s streak crosses a multiple of 7 days, you earn one Shield — banked up to 3 at a time.',
  },
  {
    icon: 'shield-sync-outline',
    title: 'Automatic protection',
    body: "If you miss a day and have a Shield banked, it's spent automatically overnight to protect that habit's streak — no action needed.",
  },
  {
    icon: 'shield-plus-outline',
    title: 'Activating one yourself',
    body: "Once a habit's streak reaches 7+ days, tap the shield icon on its Today card to protect it in advance — handy for a planned day off, like a trip or being sick.",
  },
  {
    icon: 'shield-off-outline',
    title: 'Changed your mind?',
    body: 'Tap the shield icon again to deactivate it — the Shield is refunded to your bank.',
  },
];

export default function ShieldInfoModal({ visible, onClose }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const [available, setAvailable] = useState(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    api
      .getShields()
      .then((result) => {
        if (!cancelled) setAvailable(result?.available || 0);
      })
      .catch(() => {
        if (!cancelled) setAvailable(0);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle}>Shield Days</Text>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.countCard}>
            {available === null ? (
              <ActivityIndicator color={colors.safe} />
            ) : (
              <>
                <MaterialCommunityIcons name="shield-check" size={32} color={colors.safe} />
                <Text style={styles.countText}>{available}</Text>
                <Text style={styles.countLabel}>Shield{available === 1 ? '' : 's'} banked</Text>
              </>
            )}
          </View>

          {RULES.map((rule) => (
            <View key={rule.title} style={styles.ruleRow}>
              <View style={styles.ruleIcon}>
                <MaterialCommunityIcons name={rule.icon} size={20} color={colors.accent} />
              </View>
              <View style={styles.ruleText}>
                <Text style={styles.ruleTitle}>{rule.title}</Text>
                <Text style={styles.ruleBody}>{rule.body}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function makeStyles(colors, typography) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { ...typography.sectionTitle },
    closeBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
    countCard: {
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.safeSoft,
      borderRadius: radii.lg,
      paddingVertical: spacing.xl,
      marginBottom: spacing.lg,
    },
    countText: { fontSize: 32, fontWeight: '800', color: colors.safe },
    countLabel: { ...typography.meta, color: colors.safe },
    ruleRow: {
      flexDirection: 'row',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      ...shadow,
    },
    ruleIcon: {
      width: 36,
      height: 36,
      borderRadius: radii.md,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ruleText: { flex: 1 },
    ruleTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
    ruleBody: { ...typography.body, color: colors.textSecondary, lineHeight: 19 },
  });
}
