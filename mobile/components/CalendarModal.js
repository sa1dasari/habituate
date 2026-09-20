import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { categoryIcon } from '../constants/habitCategories';
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

  const { weeks, checkedByDay } = useMemo(
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

  const selectedHabits = selectedDay ? (checkedByDay[selectedDay] || []) : [];

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

          {/* Calendar grid */}
          {weeks.map((week, wi) => (
            <View key={wi} style={styles.weekRow}>
              {week.map((cell, di) => {
                if (!cell) {
                  return <View key={di} style={styles.dayCell} />;
                }
                const isToday = cell.key === todayKey;
                const isSelected = cell.key === selectedDay;
                const dots = checkedByDay[cell.key] || [];
                const hasAny = dots.length > 0;

                return (
                  <Pressable
                    key={di}
                    style={[
                      styles.dayCell,
                      isToday && styles.dayCellToday,
                      isSelected && styles.dayCellSelected,
                    ]}
                    onPress={() => setSelectedDay(isSelected ? null : cell.key)}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        isToday && styles.dayNumberToday,
                        isSelected && styles.dayNumberSelected,
                        !cell.inMonth && styles.dayNumberFaded,
                      ]}
                    >
                      {cell.day}
                    </Text>

                    {/* Dot cluster — up to 3 dots, then a +N overflow */}
                    <View style={styles.dotRow}>
                      {hasAny ? (
                        dots.slice(0, 3).map((_, i) => (
                          <View
                            key={i}
                            style={[styles.dot, isSelected && styles.dotSelected]}
                          />
                        ))
                      ) : null}
                      {dots.length > 3 ? (
                        <Text style={styles.dotOverflow}>+{dots.length - 3}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}

          {/* Selected day detail */}
          {selectedDay ? (
            <View style={styles.detail}>
              <Text style={styles.detailTitle}>
                {formatSelectedDay(selectedDay)}
              </Text>

              {selectedHabits.length === 0 ? (
                <Text style={styles.detailEmpty}>
                  No habits checked in — and that's okay.
                </Text>
              ) : (
                selectedHabits.map((h) => (
                  <View key={h.id} style={styles.detailRow}>
                    <View style={styles.detailIcon}>
                      <MaterialCommunityIcons
                        name={categoryIcon(h.category)}
                        size={18}
                        color={colors.safe}
                      />
                    </View>
                    <View style={styles.detailText}>
                      <Text style={styles.detailHabitName}>{h.name}</Text>
                      <Text style={styles.detailMeta}>{h.category}</Text>
                    </View>
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={20}
                      color={colors.safe}
                    />
                  </View>
                ))
              )}
            </View>
          ) : (
            <Text style={styles.tapHint}>Tap a day to see which habits you completed.</Text>
          )}

          {/* Monthly summary */}
          <MonthlySummary year={year} month={month} habits={habits} checkedByDay={checkedByDay} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function MonthlySummary({ year, month, habits, checkedByDay }) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const daysElapsed = isCurrentMonth ? today.getDate() : daysInMonth;

  const rows = habits.map((h) => {
    let count = 0;
    for (let d = 1; d <= daysElapsed; d++) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if ((checkedByDay[key] || []).some((x) => x.id === h.id)) count++;
    }
    const pct = daysElapsed > 0 ? Math.round((count / daysElapsed) * 100) : 0;
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

/** Build a 2D array of week rows for the given month. Each cell is null (padding) or { key, day, inMonth }. */
function buildMonth(year, month, habits) {
  // Build a map: dateKey -> [habit, ...]
  const checkedByDay = {};
  for (const habit of habits) {
    for (const ci of habit.checkIns || []) {
      const key = toDateKey(new Date(ci.occurredAt));
      if (!checkedByDay[key]) checkedByDay[key] = [];
      checkedByDay[key].push(habit);
    }
  }

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Monday-based: Mon=0 … Sun=6
  const startDow = (firstDay.getDay() + 6) % 7;
  const totalCells = Math.ceil((startDow + lastDay.getDate()) / 7) * 7;

  const weeks = [];
  let week = [];

  for (let i = 0; i < totalCells; i++) {
    const dayOffset = i - startDow;
    const date = new Date(year, month, 1 + dayOffset);
    const inMonth = date.getMonth() === month;

    week.push({
      key: toDateKey(date),
      day: date.getDate(),
      inMonth,
    });

    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }

  return { weeks, checkedByDay };
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
  dayCellToday: {
    backgroundColor: colors.accentSoft,
  },
  dayCellSelected: {
    backgroundColor: colors.accent,
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dayNumberToday: {
    color: colors.accent,
    fontWeight: '800',
  },
  dayNumberSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dayNumberFaded: {
    color: colors.border,
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 3,
    height: 8,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.safe,
  },
  dotSelected: {
    backgroundColor: '#FFFFFF',
  },
  dotOverflow: {
    fontSize: 8,
    color: colors.textMuted,
    fontWeight: '700',
  },
  detail: {
    margin: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadow,
  },
  detailTitle: {
    ...typography.sectionTitle,
    marginBottom: spacing.md,
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
