import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from '../theme';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEKS_SHOWN = 5;
const TOTAL_DAYS = WEEKS_SHOWN * 7;

/**
 * A 5-week calendar grid (Mon–Sun columns, weeks as rows).
 * Filled dot = checked in on that day. Empty circle = no check-in.
 * Today is highlighted with an accent ring.
 *
 * Props:
 *   checkIns  – array of check-in objects with an `occurredAt` ISO string
 */
export default function HabitCalendarGrid({ checkIns = [] }) {
  const { cells, monthLabel } = useMemo(() => buildCells(checkIns), [checkIns]);

  return (
    <View style={styles.container}>
      <Text style={styles.monthLabel}>{monthLabel}</Text>

      {/* Day-of-week header */}
      <View style={styles.row}>
        {DAY_LABELS.map((label, i) => (
          <View key={i} style={styles.cell}>
            <Text style={styles.dayLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Week rows */}
      {cells.map((week, wi) => (
        <View key={wi} style={styles.row}>
          {week.map((day, di) => (
            <View key={di} style={styles.cell}>
              {day.inMonth ? (
                <View
                  style={[
                    styles.dot,
                    day.checked && styles.dotChecked,
                    day.isToday && !day.checked && styles.dotToday,
                  ]}
                >
                  {day.isToday && !day.checked ? (
                    <View style={styles.todayInner} />
                  ) : null}
                </View>
              ) : (
                <View style={styles.dotEmpty} />
              )}
            </View>
          ))}
        </View>
      ))}

      <View style={styles.legend}>
        <View style={[styles.dot, styles.dotChecked, styles.legendDot]} />
        <Text style={styles.legendText}>Checked in</Text>
        <View style={[styles.dot, styles.dotToday, styles.legendDot]} />
        <Text style={styles.legendText}>Today</Text>
      </View>
    </View>
  );
}

function toUTCDateKey(dateOrString) {
  const d = new Date(dateOrString);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function buildCells(checkIns) {
  const checkedSet = new Set((checkIns || []).map((c) => toUTCDateKey(c.occurredAt)));

  const today = new Date();
  const todayKey = toUTCDateKey(today);

  // Find the Monday on or before today, then go back (WEEKS_SHOWN - 1) more weeks
  // so today always sits in the last row.
  const todayDow = today.getDay(); // 0=Sun … 6=Sat
  const mondayOffset = todayDow === 0 ? 6 : todayDow - 1; // days since last Monday
  const gridEnd = new Date(today);
  gridEnd.setDate(today.getDate() + (6 - mondayOffset)); // end of this week (Sunday)

  const gridStart = new Date(gridEnd);
  gridStart.setDate(gridEnd.getDate() - TOTAL_DAYS + 1);

  // Month label: show the month that contains the most days in the grid
  const midpoint = new Date(gridStart);
  midpoint.setDate(gridStart.getDate() + Math.floor(TOTAL_DAYS / 2));
  const monthLabel = midpoint.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const cells = [];
  let cursor = new Date(gridStart);

  for (let w = 0; w < WEEKS_SHOWN; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const key = toUTCDateKey(cursor);
      week.push({
        key,
        inMonth: true,
        checked: checkedSet.has(key),
        isToday: key === todayKey,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    cells.push(week);
  }

  return { cells, monthLabel };
}

const DOT_SIZE = 28;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  monthLabel: {
    ...typography.meta,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
  },
  dayLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 4,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotEmpty: {
    width: DOT_SIZE,
    height: DOT_SIZE,
  },
  dotChecked: {
    backgroundColor: colors.safe,
    borderColor: colors.safe,
  },
  dotToday: {
    borderColor: colors.accent,
    borderWidth: 2,
    backgroundColor: colors.surface,
  },
  todayInner: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  legendDot: {
    width: 12,
    height: 12,
  },
  legendText: {
    fontSize: 11,
    color: colors.textMuted,
    marginRight: spacing.md,
  },
});
