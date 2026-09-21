import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import StreakIndicator from './StreakIndicator';
import { categoryIcon } from '../constants/habitCategories';
import { periodCheckIns, periodNoun as cadenceNoun } from '../utils/cadence';
import { formatClockTime, formatDayLabel, formatTime } from '../utils/time';
import { colors, radii, shadow, spacing, typography } from '../theme';

const CADENCE_LABEL = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
};

/**
 * The habit row used on Today and Habits. The check control is a circular
 * target on the right: filled when done, a neutral outline when not.
 * An un-checked habit is never styled as a failure.
 *
 * `variant="today"` is the compact mockup row — category icon tile, name, and
 * the habit's time — while the default keeps the category / cadence / streak
 * detail the Habits list needs.
 */
export default function HabitCard({
  name = 'Habit name',
  category = 'General',
  cadenceType = 'DAILY',
  trackingMode = 'BOOLEAN',
  todayCount = 0,
  scheduledTime = null,
  reminderEnabled = false,
  progressLabel = '',
  progressLines = [],
  progressComplete = false,
  periodDone = 0,
  periodTarget = 1,
  periodComplete = false,
  daysLeft = 1,
  checkIns = [],
  expanded = false,
  streak = 0,
  streakStatus = 'safe',
  checked = false,
  disabled = false,
  variant = 'detailed',
  onToggle,
  onAdd,
  onRemoveLast,
  onLogAmount,
  onPress,
  onEdit,
}) {
  const cadence = CADENCE_LABEL[String(cadenceType).toUpperCase()] || 'Daily';
  const periodNoun = cadenceNoun({ cadenceType });
  const countMode = String(trackingMode).toUpperCase() === 'COUNT';
  const [amountInput, setAmountInput] = useState('');

  // COUNT habits replace the single toggle with a stepper: tap + to log one
  // more (a second gym visit, another application), tap − to undo the most
  // recent one. Today's running total is the number in the middle.
  const stepper = (compact) => (
    <View style={compact ? styles.stepperCompact : styles.stepper}>
      <Pressable
        onPress={onRemoveLast}
        disabled={disabled || todayCount <= 0}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Remove last check-in for ${name}`}
        style={({ pressed }) => [
          styles.stepperBtn,
          (disabled || todayCount <= 0) && styles.stepperBtnDisabled,
          pressed && todayCount > 0 && !disabled ? styles.checkPressed : null,
        ]}
      >
        <MaterialCommunityIcons name="minus" size={16} color={colors.textSecondary} />
      </Pressable>

      <Text style={styles.stepperCount} numberOfLines={1}>
        {todayCount}
      </Text>

      <Pressable
        onPress={onAdd}
        disabled={disabled}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Add a check-in for ${name}`}
        style={({ pressed }) => [
          styles.stepperBtn,
          styles.stepperBtnAdd,
          pressed && !disabled ? styles.checkPressed : null,
          disabled ? styles.checkDisabled : null,
        ]}
      >
        <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" />
      </Pressable>
    </View>
  );

  if (variant === 'today') {
    const time = formatTime(scheduledTime);
    const subtitle = [time, progressLabel].filter(Boolean).join('  ·  ') || cadence;
    // Weekly and monthly habits always carry a bar; daily ones only when the
    // target is more than a single check-in.
    const showBar = String(cadenceType).toUpperCase() !== 'DAILY' || periodTarget > 1;
    const percent = periodTarget > 0
      ? Math.min(100, Math.round((periodDone / periodTarget) * 100))
      : 0;

    // A period habit shows what it has logged this week/month; a plain daily
    // habit shows its most recent check-ins instead.
    const recent = [...checkIns].sort(
      (a, b) => new Date(b.occurredAt) - new Date(a.occurredAt)
    );
    const history = showBar ? periodCheckIns({ cadenceType, checkIns }) : recent;
    const loggedToday = recent.find(
      (checkIn) => formatDayLabel(checkIn.occurredAt) === 'Today'
    );

    return (
      <View style={styles.cardShell}>
        <Pressable
          style={({ pressed }) => [styles.cardRow, pressed && onPress ? styles.cardPressed : null]}
          onPress={onPress}
          accessibilityRole={onPress ? 'button' : undefined}
          accessibilityState={onPress ? { expanded } : undefined}
          accessibilityHint={onPress ? 'Shows when this habit was logged' : undefined}
        >
          <View style={styles.iconTile}>
            <MaterialCommunityIcons
              name={categoryIcon(category)}
              size={22}
              color={colors.textSecondary}
            />
          </View>

          <View style={styles.main}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text
              style={[styles.subtitle, progressComplete ? styles.subtitleComplete : null]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>

            {showBar ? (
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${percent}%` }]} />
              </View>
            ) : null}
          </View>

          {countMode ? (
            stepper(true)
          ) : (
            <Pressable
              onPress={onToggle}
              disabled={disabled}
              hitSlop={8}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={checked ? `Undo check-in for ${name}` : `Check in ${name}`}
              style={({ pressed }) => [
                styles.check,
                styles.checkToday,
                checked ? styles.checkOn : styles.checkIdle,
                pressed && !disabled ? styles.checkPressed : null,
                disabled ? styles.checkDisabled : null,
              ]}
            >
              <MaterialCommunityIcons
                name={checked ? 'check' : 'plus'}
                size={checked ? 22 : 20}
                color={checked ? '#FFFFFF' : colors.textMuted}
              />
            </Pressable>
          )}
        </Pressable>

        {expanded ? (
          <View style={styles.expanded}>
            {countMode ? (
              <View style={styles.amountRow}>
                <TextInput
                  style={styles.amountInput}
                  keyboardType="number-pad"
                  placeholder="Add progress, e.g. 5"
                  placeholderTextColor={colors.textMuted}
                  value={amountInput}
                  onChangeText={(v) => setAmountInput(v.replace(/[^0-9]/g, ''))}
                />
                <Pressable
                  onPress={() => {
                    const n = Number(amountInput);
                    if (n > 0 && onLogAmount) onLogAmount(n);
                    setAmountInput('');
                  }}
                  disabled={disabled || !amountInput}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Add progress"
                  style={({ pressed }) => [
                    styles.amountButton,
                    (disabled || !amountInput) && styles.checkDisabled,
                    pressed && !disabled && amountInput ? styles.checkPressed : null,
                  ]}
                >
                  <Text style={styles.amountButtonText}>Add</Text>
                </Pressable>
              </View>
            ) : null}

            <Text style={styles.expandedLine}>
              {countMode
                ? todayCount > 0
                  ? `${todayCount} logged today`
                  : 'Nothing logged yet today — whenever you get to it.'
                : loggedToday
                  ? `Logged today at ${formatClockTime(loggedToday.occurredAt)}`
                  : 'Not logged yet today — whenever you get to it.'}
            </Text>

            {showBar ? (
              <Text style={styles.expandedLine}>
                {`${periodDone} of ${periodTarget} ${periodNoun}`}
                {periodComplete
                  ? ' — target met'
                  : periodNoun === 'today'
                    ? ''
                    : ` · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
              </Text>
            ) : null}

            <Text style={styles.expandedHeading}>
              {showBar ? `Logged ${periodNoun}` : 'Recent check-ins'}
            </Text>

            {history.length === 0 ? (
              <Text style={styles.expandedEmpty}>Nothing logged yet. Today can be the first.</Text>
            ) : (
              history.slice(0, 6).map((checkIn) => (
                <View key={checkIn.id ?? checkIn.occurredAt} style={styles.historyRow}>
                  <MaterialCommunityIcons
                    name="check-circle-outline"
                    size={14}
                    color={colors.safe}
                  />
                  <Text style={styles.historyText}>
                    {formatDayLabel(checkIn.occurredAt)} · {formatClockTime(checkIn.occurredAt)}
                    {countMode && checkIn.value > 1 ? ` · +${checkIn.value}` : ''}
                  </Text>
                </View>
              ))
            )}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && onPress ? styles.cardPressed : null,
      ]}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <View style={styles.main}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{category}</Text>
          </View>
          <Text style={styles.cadence}>{cadence}</Text>
          {formatTime(scheduledTime) ? (
            <View style={styles.timeRow}>
              <MaterialCommunityIcons
                name={reminderEnabled ? 'bell-outline' : 'clock-outline'}
                size={12}
                color={colors.textMuted}
              />
              <Text style={styles.cadence}>{formatTime(scheduledTime)}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.streakRow}>
          <StreakIndicator streak={streak} status={streakStatus} compact />
          <View style={styles.progressLines}>
            {(progressLines.length > 0 ? progressLines : progressLabel ? [progressLabel] : []).map(
              (line, i) => (
                <Text
                  key={i}
                  style={[styles.progress, progressComplete && i === 0 ? styles.subtitleComplete : null]}
                  numberOfLines={1}
                >
                  {line}
                </Text>
              )
            )}
          </View>
        </View>
      </View>

      {onEdit ? (
        <Pressable
          onPress={onEdit}
          disabled={disabled}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${name}`}
          style={({ pressed }) => [
            styles.edit,
            pressed && !disabled ? styles.checkPressed : null,
            disabled ? styles.checkDisabled : null,
          ]}
        >
          <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.textSecondary} />
        </Pressable>
      ) : null}

      {countMode ? (
        stepper(false)
      ) : (
        <Pressable
          onPress={onToggle}
          disabled={disabled}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          accessibilityLabel={checked ? `Undo check-in for ${name}` : `Check in ${name}`}
          style={({ pressed }) => [
            styles.check,
            checked ? styles.checkOn : styles.checkOff,
            pressed && !disabled ? styles.checkPressed : null,
            disabled ? styles.checkDisabled : null,
          ]}
        >
          <MaterialCommunityIcons
            name="check"
            size={22}
            color={checked ? '#FFFFFF' : colors.textMuted}
          />
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    ...shadow,
  },
  cardPressed: {
    opacity: 0.9,
  },
  // The today row keeps the card chrome on the shell so an expanded panel can
  // sit inside the same card instead of below it.
  cardShell: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadow,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  barTrack: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.ringTrack,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  barFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.safe,
  },
  expanded: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
  },
  expandedLine: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  expandedHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  expandedEmpty: {
    fontSize: 13,
    color: colors.textMuted,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 3,
  },
  historyText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  main: {
    flex: 1,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  name: {
    ...typography.cardTitle,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  subtitleComplete: {
    color: colors.safe,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs + 2,
  },
  chip: {
    backgroundColor: colors.background,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  cadence: {
    fontSize: 12,
    color: colors.textMuted,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  progressLines: {
    flex: 1,
    gap: 2,
  },
  progress: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  edit: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  check: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOff: {
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  checkOn: {
    backgroundColor: colors.safe,
  },
  checkToday: {
    width: 38,
    height: 38,
  },
  // Not-yet-done reads as an open invitation, not a failed state.
  checkIdle: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  checkPressed: {
    opacity: 0.7,
  },
  checkDisabled: {
    opacity: 0.5,
  },
  // Stepper (COUNT habits): − / count / + in place of the single check toggle.
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  stepperCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stepperBtn: {
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  stepperBtnAdd: {
    borderWidth: 0,
    backgroundColor: colors.safe,
  },
  stepperBtnDisabled: {
    opacity: 0.4,
  },
  stepperCount: {
    minWidth: 22,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  amountInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  amountButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.accent,
  },
  amountButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
