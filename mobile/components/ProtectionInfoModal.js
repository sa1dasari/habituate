import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../api/client';
import { useAppTheme } from '../hooks/useAppTheme';
import { radii, shadow, spacing } from '../theme';

const SHIELD_RULES = [
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
];

const FREEZE_RULES = [
  {
    icon: 'calendar-remove-outline',
    title: 'When a day doesn\'t qualify',
    body: "Depending on your group's streak rule, a day fails to qualify if some (Any member) or all (All members) of you miss checking in.",
  },
  {
    icon: 'snowflake',
    title: 'Automatic protection',
    body: "If a day doesn't qualify, your group's streak isn't reset right away — a freeze is applied automatically overnight if one's still available, and the day shows as frozen instead of broken.",
  },
];

/** Combines the personal Shield Days explainer (Habits tab) and the group Streak
 * Freezes explainer (Community tab) into one modal with a tab switcher, each tab
 * trimmed to its two most important rules — the earlier two-modal, four-rule-each
 * version was more than a new user needed to learn two protection mechanics at once. */
export default function ProtectionInfoModal({ visible, onClose, initialTab = 'shield' }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const [tab, setTab] = useState(initialTab);
  const [available, setAvailable] = useState(null);

  useEffect(() => {
    if (visible) setTab(initialTab);
  }, [visible, initialTab]);

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

  const isShield = tab === 'shield';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle}>Streak Protection</Text>
          <View style={{ width: 34 }} />
        </View>

        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tabPill, isShield && styles.tabPillActive]}
            onPress={() => setTab('shield')}
            accessibilityRole="button"
            accessibilityLabel="Shield Days"
          >
            <Text style={[styles.tabText, isShield && styles.tabTextActive]}>Shield Days</Text>
          </Pressable>
          <Pressable
            style={[styles.tabPill, !isShield && styles.tabPillActive]}
            onPress={() => setTab('freeze')}
            accessibilityRole="button"
            accessibilityLabel="Streak Freezes"
          >
            <Text style={[styles.tabText, !isShield && styles.tabTextActive]}>Streak Freezes</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {isShield ? (
            <View style={[styles.countCard, { backgroundColor: colors.safeSoft }]}>
              {available === null ? (
                <ActivityIndicator color={colors.safe} />
              ) : (
                <>
                  <MaterialCommunityIcons name="shield-check" size={32} color={colors.safe} />
                  <Text style={[styles.countText, { color: colors.safe }]}>{available}</Text>
                  <Text style={[styles.countLabel, { color: colors.safe }]}>
                    Shield{available === 1 ? '' : 's'} banked
                  </Text>
                </>
              )}
            </View>
          ) : (
            <View style={[styles.countCard, { backgroundColor: colors.frozenSoft }]}>
              <MaterialCommunityIcons name="snowflake" size={32} color={colors.frozen} />
              <Text
                style={[
                  styles.countLabel,
                  { color: colors.frozen, textAlign: 'center', paddingHorizontal: spacing.lg },
                ]}
              >
                Protects your Shared Habit's group streak
              </Text>
            </View>
          )}

          {(isShield ? SHIELD_RULES : FREEZE_RULES).map((rule) => (
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
    tabRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: spacing.md,
    },
    tabPill: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    tabPillActive: { backgroundColor: colors.accentSoft },
    tabText: { ...typography.label, color: colors.textSecondary },
    tabTextActive: { color: colors.accent },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
    countCard: {
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radii.lg,
      paddingVertical: spacing.xl,
      marginBottom: spacing.lg,
    },
    countText: { fontSize: 32, fontWeight: '800' },
    countLabel: { ...typography.meta },
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
