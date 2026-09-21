import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { categoryIcon } from '../constants/habitCategories';
import { cadenceTarget, hasDailyTarget } from '../utils/cadence';
import { toDateKey } from '../utils/date';
import { colors, radii, shadow, spacing, typography } from '../theme';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Full-page monthly calendar modal (Samsung Health style).
 *
 * Props:
 *   visible   – boolean
 *   habits    – enriched habit array from useHabits (each has .checkIns[])
 *   onClose   – () => void
 */
export default function CalendarModal({ visible, habits = [], onClose }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-based
  const [selectedDay, setSelectedDay] = useState(null); // 'YYYY-MM-DD' or null

  const { weeks, dayStats } = useMemo(
    () => buildMonth(year, month, habits),
    [year, month, habits]
  );

  const todayKey = toDateKey(today);

  const goBack = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
    setSelectedDay(null);
  };

  const goForward = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
    setSelectedDay(null);
  };

  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const selectedStats = selectedDay ? dayStats[selectedDay] : null;
  const selectedStreak = selectedDay ? allDoneStreak(selectedDay, weeks, dayStats) : 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle}>Habit Calendar</Text>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Month navigation */}
          <View style={styles.monthNav}>
            <Pressable onPress={goBack} hitSlop={12} style={styles.navBtn}>
              <MaterialCommunityIcons name="chevron-left" size={26} color={colors.textPrimary} />
            </Pressable>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <Pressable
              onPress={goForward}
              hitSlop={12}
              style={styles.navBtn}
              disabled={year === today.getFullYear() && month === today.getMonth()}
            >
              <MaterialCommunityIcons
                name="chevron-right"
                size={26}
                color={
                  year === today.getFullYear() && month === today.getMonth()
                    ? colors.border
                    : colors.textPrimary
                }
              />
            </Pressable>
          </View>

          {/* Day-of-week header */}
          <View style={styles.weekRow}>
            {DAY_LABELS.map((d) => (
              <View key={d} style={styles.dayHeaderCell}>
                <Text style={styles.dayHeaderText}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Calendar grid — each day is tinted by how much of that day's
              daily-target habits were completed: all done (green), some
              (amber), none (grey). Weekly/monthly check-ins that day show as
              a small dot instead, since they're never "due" on a specific day. */}
          {weeks.map((week, wi) => (
            <View key={wi} style={styles.weekRow}>
              {week.map((cell, di) => {
                if (!cell) {
                  return <View key={di} style={styles.dayCell} />;
                }
                const isToday = cell.key === todayKey;
                const isSelected = cell.key === selectedDay;
                const stats = dayStats[cell.key];
                const heat = dayHeat(stats);
                const hasOtherActivity = stats.entries.some((e) => !e.isDaily);

                return (
                  <Pressable
                    key={di}
                    style={[
                      styles.dayCell,
                      heat === 'all' && styles.dayCellAll,
                      heat === 'some' && styles.dayCellSome,
                      isToday && styles.dayCellToday,
                      isSelected && styles.dayCellSelected,
                    ]}
                    onPress={() => setSelectedDay(isSelected ? null : cell.key)}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        heat === 'all' && styles.dayNumberAll,
                        heat === 'some' && styles.dayNumberSome,
                        isSelected && styles.dayNumberSelected,
                        !cell.inMonth && styles.dayNumberFaded,
                      ]}
                    >
                      {cell.day}
                    </Text>

                    {hasOtherActivity ? (
                      <View style={[styles.otherDot, isSelected && styles.otherDotSelected]} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}

          {/* Legend */}
          <View style={styles.legendRow}>
            <LegendItem swatchStyle={styles.legendAll} label="All daily habits" />
            <LegendItem swatchStyle={styles.legendSome} label="Some" />
            <LegendItem swatchStyle={styles.legendNone} label="None yet" />
            <LegendItem dotStyle={styles.legendDot} label="Weekly / monthly" />
          </View>

          {/* Selected day detail */}
          {selectedDay && selectedStats ? (
            <View style={styles.detail}>
              <View style={styles.detailHeader}>
                <Text style={styles.detailTitle}>{formatSelectedDay(selectedDay)}</Text>
                {selectedStats.dailyTotal > 0 ? (
                  <View style={styles.detailBadge}>
                    <Text style={styles.detailBadgeText}>
                      {Math.round((selectedStats.dailyDone / selectedStats.dailyTotal) * 100)}% done
                    </Text>
                  </View>
                ) : null}
              </View>

              {selectedStats.dailyTotal > 0 ? (
                <>
                  <Text style={styles.detailSubtitle}>
                    {selectedStats.dailyTotal} daily habit{selectedStats.dailyTotal === 1 ? '' : 's'} ·{' '}
                    {selectedStats.dailyDone} completed
                  </Text>

                  <View style={styles.statRow}>
                    <View style={styles.statTile}>
                      <Text style={styles.statValue}>{selectedStats.dailyDone}</Text>
                      <Text style={styles.statLabel}>Completed</Text>
                    </View>
                    <View style={styles.statTile}>
                      <Text style={styles.statValue}>
                        {selectedStats.dailyTotal - selectedStats.dailyDone}
                      </Text>
                      <Text style={styles.statLabel}>Remaining</Text>
                    </View>
                    <View style={styles.statTile}>
                      <Text style={styles.statValue}>{selectedStreak}</Text>
                      <Text style={styles.statLabel}>Day streak</Text>
                    </View>
                  </View>
                </>
              ) : null}

              {selectedStats.entries.length === 0 ? (
                <Text style={styles.detailEmpty}>Nothing logged — and that's okay.</Text>
              ) : (
                selectedStats.entries.map(({ habit, value, isDaily, done }) => (
                  <View key={habit.id} style={styles.detailRow}>
                    <View style={[styles.detailIcon, !done && styles.detailIconIdle]}>
                      <MaterialCommunityIcons
                        name={categoryIcon(habit.category)}
                        size={18}
                        color={done ? colors.safe : colors.textMuted}
                      />
                    </View>
                    <View style={styles.detailText}>
                      <Text style={styles.detailHabitName}>{habit.name}</Text>
                      <Text style={styles.detailMeta}>
                        {isDaily
                          ? done
                            ? value > 1
                              ? `Completed · logged ${value}×`
                              : 'Completed'
                            : 'Not yet logged'
                          : `Logged${value > 1 ? ` ${value}×` : ''} today`}
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name={done ? 'check-circle' : 'circle-outline'}
                      size={20}
                      color={done ? colors.safe : colors.border}
                    />
                  </View>
                ))
              )}
            </View>
          ) : (
            <Text style={styles.tapHint}>Tap a day to see how it went.</Text>
          )}

          {/* Monthly summary */}
          <MonthlySummary year={year} month={month} habits={habits} dayStats={dayStats} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function LegendItem({ swatchStyle, dotStyle, label }) {
  return (
    <View style={styles.legendItem}>
      {dotStyle ? (
        <View style={[styles.legendSwatch, styles.legendSwatchDot, dotStyle]} />
      ) : (
        <View style={[styles.legendSwatch, swatchStyle]} />
      )}
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function MonthlySummary({ year, month, habits, dayStats }) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const daysElapsed = isCurrentMonth ? today.getDate() : daysInMonth;

  const rows = habits.map((h) => {
    let count = 0;
    let possibleDays = 0;
    for (let d = 1; d <= daysElapsed; d++) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (!existedOn(h, key)) continue;
      possibleDays++;
      const stats = dayStats[key];
      if (stats && stats.entries.some((e) => e.habit.id === h.id)) count++;
    }
    const pct = possibleDays > 0 ? Math.round((count / possibleDays) * 100) : 0;
    return { habit: h, count, pct };
  }).filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  if (rows.length === 0) return null;

  return (
    <View style={styles.summary}>
      <Text style={styles.summaryTitle}>This month</Text>
      {rows.map(({ habit, count, pct }) => (
        <View key={habit.id} style={styles.summaryRow}>
          <MaterialCommunityIcons
            name={categoryIcon(habit.category)}
            size={16}
            color={colors.textSecondary}
            style={{ marginRight: spacing.sm }}
          />
          <Text style={styles.summaryName} numberOfLines={1}>{habit.name}</Text>
          <View style={styles.summaryBarWrap}>
            <View style={[styles.summaryBar, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.summaryCount}>{count}d</Text>
        </View>
      ))}
    </View>
  );
}

/** Sum of check-in values a habit logged on one calendar day (BOOLEAN check-ins default to 1). */
function sumValueForDay(habit, dayKey) {
  return (habit.checkIns || []).reduce((sum, ci) => {
    if (toDateKey(new Date(ci.occurredAt)) !== dayKey) return sum;
    return sum + (Number(ci.value) || 1);
  }, 0);
}

/** A habit only counts toward a day's stats once it actually existed — a habit
 * created today shouldn't retroactively make yesterday look incomplete. */
function existedOn(habit, dayKey) {
  if (!habit || !habit.createdAt) return true;
  return toDateKey(new Date(habit.createdAt)) <= dayKey;
}

/**
 * Per-day stats: how many of that day's daily-target habits (only ones that
 * existed by then) were completed — a COUNT habit needs its values to sum to
 * its daily target, so a batch of 9 job applications still counts as one
 * habit "done", not nine — plus every other habit (weekly/monthly-only) that
 * had any activity that day.
 */
function computeDayStats(dayKey, habits) {
  const entries = [];
  let dailyTotal = 0;
  let dailyDone = 0;

  const existing = habits.filter((h) => existedOn(h, dayKey));

  existing.forEach((habit) => {
    if (!hasDailyTarget(habit)) return;
    dailyTotal += 1;
    const value = sumValueForDay(habit, dayKey);
    const target = cadenceTarget(habit);
    const done = value >= target;
    if (done) dailyDone += 1;
    entries.push({ habit, value, isDaily: true, done });
  });

  existing.forEach((habit) => {
    if (hasDailyTarget(habit)) return;
    const value = sumValueForDay(habit, dayKey);
    if (value > 0) entries.push({ habit, value, isDaily: false, done: true });
  });

  return { dailyTotal, dailyDone, entries };
}

function dayHeat(stats) {
  if (!stats || stats.dailyTotal === 0 || stats.dailyDone === 0) return 'none';
  if (stats.dailyDone >= stats.dailyTotal) return 'all';
  return 'some';
}

/** Consecutive "all daily habits done" days ending at dayKey, walking backward through the visible grid. */
function allDoneStreak(dayKey, weeks, dayStats) {
  const flat = weeks.flat().filter(Boolean).map((c) => c.key);
  const idx = flat.indexOf(dayKey);
  if (idx === -1) return 0;

  let streak = 0;
  for (let i = idx; i >= 0; i--) {
    const stats = dayStats[flat[i]];
    if (!stats || stats.dailyTotal === 0 || stats.dailyDone < stats.dailyTotal) break;
    streak += 1;
  }
  return streak;
}

/** Build a 2D array of week rows for the given month. Each cell is null (padding) or { key, day, inMonth }. */
function buildMonth(year, month, habits) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Monday-based: Mon=0 … Sun=6
  const startDow = (firstDay.getDay() + 6) % 7;
  const totalCells = Math.ceil((startDow + lastDay.getDate()) / 7) * 7;

  const weeks = [];
  let week = [];
  const dayStats = {};

  for (let i = 0; i < totalCells; i++) {
    const dayOffset = i - startDow;
    const date = new Date(year, month, 1 + dayOffset);
    const inMonth = date.getMonth() === month;
    const key = toDateKey(date);

    week.push({ key, day: date.getDate(), inMonth });
    dayStats[key] = computeDayStats(key, habits);

    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }

  return { weeks, dayStats };
}

function formatSelectedDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

const DAY_CELL_SIZE = 44;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
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
  headerTitle: {
    ...typography.sectionTitle,
  },
  closeBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingBottom: spacing.xxl,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  navBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: spacing.sm,
  },
  dayHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  dayCell: {
    flex: 1,
    height: DAY_CELL_SIZE + 14,
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderRadius: radii.sm,
    marginBottom: 2,
  },
  dayCellAll: {
    backgroundColor: colors.safeSoft,
  },
  dayCellSome: {
    backgroundColor: colors.warningSoft,
  },
  // "None" is deliberately unstyled (plain background) — grey/muted text
  // carries that state instead of a filled cell, so an empty day never reads
  // as a red-X-style failure block.
  dayCellToday: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  dayCellSelected: {
    backgroundColor: colors.accent,
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  dayNumberAll: {
    color: colors.safe,
    fontWeight: '800',
  },
  dayNumberSome: {
    color: colors.warning,
    fontWeight: '800',
  },
  dayNumberSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dayNumberFaded: {
    color: colors.border,
  },
  otherDot: {
    width: 5,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    marginTop: 4,
  },
  otherDotSelected: {
    backgroundColor: '#FFFFFF',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: radii.sm - 3,
  },
  legendSwatchDot: {
    borderRadius: radii.pill,
  },
  legendAll: {
    backgroundColor: colors.safeSoft,
    borderWidth: 1,
    borderColor: colors.safe,
  },
  legendSome: {
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  legendNone: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  legendDot: {
    backgroundColor: colors.accent,
  },
  legendText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  detail: {
    margin: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadow,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailTitle: {
    ...typography.sectionTitle,
  },
  detailBadge: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  detailBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  detailSubtitle: {
    ...typography.meta,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statTile: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  detailEmpty: {
    ...typography.body,
    color: colors.textSecondary,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.safeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  detailIconIdle: {
    backgroundColor: colors.neutralSoft,
  },
  detailText: {
    flex: 1,
  },
  detailHabitName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  detailMeta: {
    ...typography.meta,
    marginTop: 2,
  },
  tapHint: {
    ...typography.meta,
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginHorizontal: spacing.xl,
  },
  summary: {
    margin: spacing.lg,
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadow,
  },
  summaryTitle: {
    ...typography.sectionTitle,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  summaryName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    width: 100,
    marginRight: spacing.sm,
  },
  summaryBarWrap: {
    flex: 1,
    height: 6,
    backgroundColor: colors.ringTrack,
    borderRadius: radii.pill,
    overflow: 'hidden',
    marginRight: spacing.sm,
  },
  summaryBar: {
    height: '100%',
    backgroundColor: colors.safe,
    borderRadius: radii.pill,
  },
  summaryCount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    width: 28,
    textAlign: 'right',
  },
});
