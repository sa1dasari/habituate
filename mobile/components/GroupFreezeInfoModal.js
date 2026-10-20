import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { radii, shadow, spacing } from '../theme';

const RULES = [
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
  {
    icon: 'account-cog-outline',
    title: 'How many freezes your group gets',
    body: 'Whoever created the shared habit sets "skip days allowed a month" (0-3) in Advanced settings — that\'s how many freezes your group can use in any rolling 30-day window before a missed day actually resets the streak.',
  },
  {
    icon: 'alert-circle-outline',
    title: 'Once freezes run out',
    body: "Once your group's used up its freezes for the last 30 days, the next day that doesn't qualify resets the streak to zero — same as any streak, just with a few free passes first.",
  },
];

/** The Shared Habit equivalent of Habits' ShieldInfoModal — explains the "frozen" badge that
 * shows up on a group's streak once StreakFreezeScheduler auto-applies a group-grace freeze,
 * which was otherwise undiscoverable (no count, no indicator, just an icon with no legend). */
export default function GroupFreezeInfoModal({ visible, onClose }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle}>Streak Freezes</Text>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.countCard}>
            <MaterialCommunityIcons name="snowflake" size={32} color={colors.frozen} />
            <Text style={styles.countLabel}>Protects your Shared Habit's group streak</Text>
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

          <Text style={styles.footnote}>
            Created this Shared Habit? Tap the pencil icon on it, then Advanced settings, to
            change how many skip days it gets a month.
          </Text>
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
      backgroundColor: colors.frozenSoft,
      borderRadius: radii.lg,
      paddingVertical: spacing.xl,
      marginBottom: spacing.lg,
    },
    countLabel: { ...typography.meta, color: colors.frozen, textAlign: 'center', paddingHorizontal: spacing.lg },
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
    footnote: { ...typography.meta, textAlign: 'center', marginTop: spacing.sm },
  });
}
