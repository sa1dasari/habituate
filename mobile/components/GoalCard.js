import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { daysLeftInPeriod } from '../utils/cadence';
import { colors, radii, shadow, spacing, typography } from '../theme';

const PERIOD_NOUN = { WEEKLY: 'this week', MONTHLY: 'this month' };

/**
 * A freeform goal — manual progress via a +/- stepper, since there's no
 * underlying habit or check-in stream to derive it from. When the goal's
 * period has rolled over (`needsReview`), the stepper is replaced by a
 * review of how the just-ended period went, framed as a trend rather than
 * pass/fail, with Roll over / Dismiss actions.
 */
export default function GoalCard({
  goal,
  disabled = false,
  onIncrement,
  onDecrement,
  onLogAmount,
  onEdit,
  onDelete,
  onRollover,
  onDismiss,
}) {
  const periodNoun = PERIOD_NOUN[goal.period] || 'this period';
  const [amountInput, setAmountInput] = useState('');

  if (goal.needsReview) {
    const hit = goal.currentCount >= goal.targetCount;
    return (
      <View style={styles.card}>
        <Text style={styles.name}>{goal.description}</Text>
        <Text style={styles.reviewLine}>
          {hit
            ? `You hit it — ${goal.currentCount} of ${goal.targetCount} ${periodNoun.replace('this', 'last')}.`
            : `${goal.currentCount} of ${goal.targetCount} ${periodNoun.replace('this', 'last')} — close, but not quite.`}
        </Text>
        <View style={styles.reviewActions}>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => onDismiss && onDismiss(goal)}
            disabled={disabled}
          >
            <Text style={styles.secondaryBtnText}>Dismiss</Text>
          </Pressable>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => onRollover && onRollover(goal)}
            disabled={disabled}
          >
            <Text style={styles.primaryBtnText}>Roll over</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const daysLeft = daysLeftInPeriod({ cadenceType: goal.period });

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.name} numberOfLines={2}>
          {goal.description}
        </Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => onEdit && onEdit(goal)} hitSlop={8} style={styles.iconBtn}>
            <MaterialCommunityIcons name="pencil-outline" size={16} color={colors.textSecondary} />
          </Pressable>
          <Pressable onPress={() => onDelete && onDelete(goal)} hitSlop={8} style={styles.iconBtn}>
            <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${goal.percent}%` }]} />
      </View>

      <View style={styles.footerRow}>
        <Text style={[styles.progressText, goal.complete && styles.progressTextComplete]}>
          {goal.currentCount} of {goal.targetCount}
          {goal.complete ? ' — done' : ` ${periodNoun}`}
        </Text>
        <Text style={styles.daysLeft}>{daysLeft} day{daysLeft === 1 ? '' : 's'} left</Text>
      </View>

      <View style={styles.progressRow}>
        <View style={styles.amountRow}>
          <TextInput
            style={styles.amountInput}
            keyboardType="number-pad"
            placeholder="Add progress, e.g. 50"
            placeholderTextColor={colors.textMuted}
            value={amountInput}
            onChangeText={(v) => setAmountInput(v.replace(/[^0-9]/g, ''))}
            editable={!disabled}
          />
          <Pressable
            style={[styles.amountButton, (disabled || !amountInput) && styles.checkDisabled]}
            onPress={() => {
              const n = Number(amountInput);
              if (n > 0 && onLogAmount) onLogAmount(goal, n);
              setAmountInput('');
            }}
            disabled={disabled || !amountInput}
            hitSlop={6}
            accessibilityLabel={`Add progress toward ${goal.description}`}
          >
            <Text style={styles.amountButtonText}>Add</Text>
          </Pressable>
        </View>

        <View style={styles.stepper}>
          <Pressable
            style={[styles.stepperBtn, (disabled || goal.currentCount <= 0) && styles.stepperBtnDisabled]}
            onPress={() => onDecrement && onDecrement(goal)}
            disabled={disabled || goal.currentCount <= 0}
            hitSlop={6}
            accessibilityLabel={`Remove one from ${goal.description}`}
          >
            <MaterialCommunityIcons name="minus" size={16} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            style={[styles.stepperBtn, styles.stepperBtnAdd, disabled && styles.checkDisabled]}
            onPress={() => onIncrement && onIncrement(goal)}
            disabled={disabled}
            hitSlop={6}
            accessibilityLabel={`Add one to ${goal.description}`}
          >
            <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  name: {
    ...typography.cardTitle,
    flex: 1,
  },
  barTrack: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.ringTrack,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  barFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  progressText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  progressTextComplete: {
    color: colors.safe,
    fontWeight: '600',
  },
  daysLeft: {
    ...typography.meta,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  amountRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  amountInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  amountButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.accent,
  },
  amountButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepper: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  stepperBtnAdd: {
    borderWidth: 0,
    backgroundColor: colors.accent,
  },
  stepperBtnDisabled: {
    opacity: 0.4,
  },
  checkDisabled: {
    opacity: 0.5,
  },
  reviewLine: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  reviewActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  secondaryBtn: {
    borderRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  secondaryBtnText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
});
