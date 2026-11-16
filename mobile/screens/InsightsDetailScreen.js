import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../api/client';
import Toast from '../components/Toast';
import { categoryColor, HABIT_CATEGORY_COLORS } from '../constants/habitCategories';
import { useAppTheme } from '../hooks/useAppTheme';
import { useHabits } from '../hooks/useHabits';
import { useToast } from '../hooks/useToast';
import { buildPeriodDetails, plural } from '../utils/insightsDetails';
import { buildCategoryTowerColors, fonts, radii, skylineTowerTheme, skylineUI, spacing } from '../theme';

const towerColorsByMode = buildCategoryTowerColors(HABIT_CATEGORY_COLORS);
const CHART_HEIGHT = 110;
const STRIP_GAP = 6;

/**
 * Insights details page (design-review boards 31-33, owner-approved
 * 2026-11-14): everything for one week, month or year — summary tiles, a
 * day-by-day (month-by-month for a year) stacked chart, and one card per
 * habit. Pushed from InsightsScreen's Floors built card; prev/next arrows
 * step through every earlier period (next is disabled on the live one), and
 * only the chip-selected habits are shown. All numbers come from the pure
 * `buildPeriodDetails` (utils/insightsDetails.js).
 */
export default function InsightsDetailScreen({ navigation, route }) {
  const { colors, typography, effectiveMode } = useAppTheme();
  const amber = skylineUI[effectiveMode].amber;
  const towerTheme = skylineTowerTheme[effectiveMode];
  const styles = useMemo(() => makeStyles(colors, typography, amber), [colors, typography, amber]);
  const insets = useSafeAreaInsets();
  const { habits } = useHabits();
  const { toast, showToast, hideToast } = useToast();

  const { period, habitIds = [] } = route.params;
  const [startMs, setStartMs] = useState(route.params.startMs);
  const [shieldedByHabit, setShieldedByHabit] = useState({});

  const habitCategoryColors = towerColorsByMode[effectiveMode];
  const habitColor = (habit) => (habitCategoryColors && habitCategoryColors[habit.category]) || categoryColor(habit.category);

  const shownHabits = useMemo(
    () => (habitIds.length === 0 ? habits : habits.filter((h) => habitIds.includes(h.id))),
    [habits, habitIds]
  );

  const idsKey = shownHabits.map((h) => h.id).join(',');
  useEffect(() => {
    if (shownHabits.length === 0) return undefined;
    let cancelled = false;
    Promise.all(
      shownHabits.map((h) =>
        api
          .getShieldedDates(h.id)
          .then((dates) => [h.id, dates || []])
          .catch((err) => {
            if (!cancelled) showToast(`Could not load Shield Days — ${err.message}`, 'error');
            return [h.id, []];
          })
      )
    ).then((pairs) => {
      if (!cancelled) setShieldedByHabit(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const details = useMemo(
    () => buildPeriodDetails(shownHabits, period, startMs, shieldedByHabit, new Date()),
    [shownHabits, period, startMs, shieldedByHabit]
  );

  const maxChart = Math.max(1, ...details.chart.map((c) => c.total));
  const legendHabits = shownHabits.filter((h) => details.chart.some((c) => c.byHabit[h.id]));
  const dense = details.chart.length > 12;

  const byHabitSubtitle = period === 'weekly' ? 'Mon to Sun' : period === 'monthly' ? 'Each row is 7 days' : 'Floors per month';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: spacing.xl + insets.bottom }]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={8}
            testID="insights-detail-back"
            accessibilityRole="button"
            accessibilityLabel="Back to Insights"
          >
            <MaterialCommunityIcons name="chevron-left" size={22} color={colors.textPrimary} />
            <Text style={styles.backLabel}>Insights</Text>
          </Pressable>
          <View style={styles.navBtns}>
            <Pressable
              onPress={() => setStartMs(details.prevStartMs)}
              style={styles.circleBtn}
              testID="insights-detail-prev"
              accessibilityRole="button"
              accessibilityLabel={`Previous ${details.kind}`}
            >
              <MaterialCommunityIcons name="chevron-left" size={22} color={colors.textPrimary} />
            </Pressable>
            <Pressable
              onPress={() => setStartMs(details.nextStartMs)}
              disabled={details.isCurrent}
              style={[styles.circleBtn, details.isCurrent && styles.circleBtnDisabled]}
              testID="insights-detail-next"
              accessibilityRole="button"
              accessibilityLabel={`Next ${details.kind}`}
              accessibilityState={{ disabled: details.isCurrent }}
            >
              <MaterialCommunityIcons name="chevron-right" size={22} color={details.isCurrent ? colors.textMuted : colors.textPrimary} />
            </Pressable>
          </View>
        </View>

        <Text style={styles.eyebrow}>{details.eyebrow}</Text>
        <Text style={styles.title}>{details.title}</Text>
        <Text style={styles.subtitle}>{details.subtitle}</Text>

        <View style={styles.tilesRow}>
          {details.tiles.map((tile, i) => (
            <View key={i} style={styles.tile}>
              <Text style={styles.tileNumber}>{typeof tile.number === 'number' ? tile.number.toLocaleString('en-US') : tile.number}</Text>
              <Text style={styles.tileLabel}>{tile.label}</Text>
              <Text style={styles.tileDetail}>{tile.detail}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{details.chartTitle}</Text>
          <View style={styles.chartRow}>
            {details.chart.map((slot) => (
              <View
                key={slot.key}
                style={styles.chartCol}
                accessible
                accessibilityLabel={`${slot.long}, ${slot.total} built`}
              >
                <View style={[styles.chartTrack, dense && styles.chartTrackDense]}>
                  {slot.total === 0 ? (
                    <View style={styles.chartEmpty} />
                  ) : (
                    shownHabits
                      .filter((h) => slot.byHabit[h.id])
                      .map((h) => (
                        <View
                          key={h.id}
                          style={[styles.chartSeg, { height: (slot.byHabit[h.id] / maxChart) * CHART_HEIGHT, backgroundColor: habitColor(h) }]}
                        />
                      ))
                  )}
                </View>
                <Text style={[styles.chartLabel, slot.isToday && styles.chartLabelToday]} numberOfLines={1}>
                  {dense ? (Number(slot.label) === 1 || Number(slot.label) % 7 === 1 ? slot.label : ' ') : period === 'yearly' ? slot.long : slot.label}
                </Text>
              </View>
            ))}
          </View>
          {legendHabits.length > 0 ? (
            <View style={styles.legendRow}>
              {legendHabits.map((h) => (
                <View key={h.id} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: habitColor(h) }]} />
                  <Text style={styles.legendText} numberOfLines={1}>
                    {h.name}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>By habit</Text>
            <Text style={styles.cardTag}>{byHabitSubtitle}</Text>
          </View>

          {details.perHabit.length === 0 ? (
            <Text style={styles.emptyText}>No habits to show.</Text>
          ) : (
            details.perHabit.map((row) => (
              <HabitCard
                key={row.habit.id}
                row={row}
                period={period}
                color={habitColor(row.habit)}
                towerTheme={towerTheme}
                amber={amber}
                colors={colors}
                styles={styles}
              />
            ))
          )}
        </View>

        <Text style={styles.footnote}>A glass square is a Shield Day. A soft outline is an open day. Floors never come down.</Text>
      </ScrollView>
      <Toast toast={toast} onHide={hideToast} />
    </SafeAreaView>
  );
}

function HabitCard({ row, period, color, towerTheme, amber, colors, styles }) {
  const { habit, daily } = row;
  const countLabel = daily ? plural(row.count, 'floor') : plural(row.count, 'check-in');
  const lotWord = habit.monthlyTarget ? 'monthly' : 'weekly';

  return (
    <View style={styles.habitCard} testID={`insights-detail-habit-${habit.id}`}>
      <View style={styles.habitHeader}>
        <View style={styles.habitNameWrap}>
          <View style={[styles.legendDot, { backgroundColor: color }]} />
          <Text style={styles.habitName} numberOfLines={2}>
            {habit.name}
            {!daily ? <Text style={styles.habitKind}> · lot, {lotWord}</Text> : null}
          </Text>
        </View>
        <Text style={styles.habitCount}>{countLabel}</Text>
      </View>

      {daily ? (
        <>
          <Text style={styles.habitSub}>{row.comparison}</Text>
          {row.cells ? (
            <CellStrip cells={row.cells} columns={7} color={color} towerTheme={towerTheme} amber={amber} styles={styles} colors={colors} tall={period === 'weekly'} />
          ) : null}
          {row.months ? <MonthBars months={row.months} color={color} styles={styles} /> : null}
          <View style={styles.runRow}>
            <Text style={styles.runText}>
              Run <Text style={styles.runStrong}>{row.run.current} {row.run.current === 1 ? 'day' : 'days'}</Text> · best {row.run.best}
            </Text>
            {row.shieldDaysUsed > 0 ? (
              <View style={styles.shieldNote}>
                <View style={[styles.glassMini, { backgroundColor: towerTheme.shieldFill, borderColor: towerTheme.shieldEdge }]}>
                  <MaterialCommunityIcons name="shield" size={8} color={towerTheme.shieldIcon} />
                </View>
                <Text style={styles.runText}>
                  {row.shieldDaysUsed} Shield {row.shieldDaysUsed === 1 ? 'Day' : 'Days'} used
                </Text>
              </View>
            ) : null}
          </View>
        </>
      ) : (
        <LotBody row={row} period={period} color={color} styles={styles} />
      )}
    </View>
  );
}

function LotBody({ row, period, color, styles }) {
  const { lot } = row;
  const unitWord = lot.unit === 'month' ? 'month' : 'week';
  if (period === 'yearly' && row.months) {
    return (
      <>
        <Text style={styles.habitSub}>{lot.unit === 'month' ? 'Monthly' : 'Weekly'} target {lot.target}</Text>
        <MonthBars months={row.months} color={color} styles={styles} />
        {lot.unit === 'month' ? (
          <Text style={styles.runText}>
            Target met in {lot.metMonths} of {lot.reachedMonths} months · closest {lot.closest} of {lot.target}
          </Text>
        ) : null}
      </>
    );
  }
  const pct = lot.target > 0 ? Math.min(100, (lot.inUnit / lot.target) * 100) : 0;
  return (
    <>
      <Text style={styles.habitSub}>
        {lot.inUnit} of {lot.target} this {unitWord}
      </Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.runText}>
        {lot.unit === 'month' ? 'Monthly' : 'Weekly'} target {lot.target} · {lot.remaining} to go
      </Text>
    </>
  );
}

function CellStrip({ cells, columns, color, towerTheme, amber, styles, colors, tall }) {
  const rows = [];
  for (let i = 0; i < cells.length; i += columns) rows.push(cells.slice(i, i + columns));
  return (
    <View style={styles.strip}>
      {rows.map((rowCells, r) => (
        <View key={r} style={styles.stripRow}>
          {rowCells.map((cell) => (
            <Cell key={cell.key} cell={cell} color={color} towerTheme={towerTheme} amber={amber} styles={styles} colors={colors} tall={tall} />
          ))}
          {Array.from({ length: columns - rowCells.length }).map((_, i) => (
            <View key={`pad-${i}`} style={styles.cellPad} />
          ))}
        </View>
      ))}
    </View>
  );
}

function Cell({ cell, color, towerTheme, amber, styles, colors, tall }) {
  const size = tall ? styles.cellTall : styles.cell;
  const label = `${cell.label}, ${cell.state === 'set' ? 'built' : cell.state === 'glass' ? 'Shield Day' : cell.state === 'open' ? 'open' : cell.state === 'today' ? 'today, open' : 'not yet'}`;
  if (cell.state === 'set') return <View style={[size, styles.cellSet, { backgroundColor: color }]} accessible accessibilityLabel={label} />;
  if (cell.state === 'glass') {
    return (
      <View
        style={[size, styles.cellGlass, { backgroundColor: towerTheme.shieldFill, borderColor: towerTheme.shieldEdge }]}
        accessible
        accessibilityLabel={label}
      >
        <MaterialCommunityIcons name="shield" size={tall ? 18 : 12} color={towerTheme.shieldIcon} />
      </View>
    );
  }
  if (cell.state === 'open') return <View style={[size, styles.cellOpen, { borderColor: colors.textMuted }]} accessible accessibilityLabel={label} />;
  if (cell.state === 'today') return <View style={[size, styles.cellDashed, { borderColor: amber }]} accessible accessibilityLabel={label} />;
  return <View style={[size, styles.cellDashed, { borderColor: colors.border }]} accessible accessibilityLabel={label} />;
}

function MonthBars({ months, color, styles }) {
  const max = Math.max(1, ...months.map((m) => m.value));
  return (
    <View style={styles.monthBars}>
      {months.map((m, i) => (
        <View key={i} style={styles.monthCol}>
          <View style={styles.monthTrack}>
            <View style={[styles.monthBar, { height: m.isFuture ? 2 : Math.max(2, (m.value / max) * 48), backgroundColor: color, opacity: m.isFuture ? 0.25 : 1 }]} />
          </View>
          <Text style={styles.monthLabel}>{m.label}</Text>
        </View>
      ))}
    </View>
  );
}

function makeStyles(colors, typography, amber) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    container: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
    backBtn: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
    backLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary },
    navBtns: { flexDirection: 'row', gap: spacing.sm },
    circleBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    circleBtnDisabled: { opacity: 0.5 },
    eyebrow: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.8, color: colors.textMuted },
    title: { fontFamily: fonts.extraBold, fontSize: 30, color: colors.textPrimary, marginTop: 2 },
    subtitle: { ...typography.meta, marginTop: 2, marginBottom: spacing.lg },
    tilesRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
    tile: { flex: 1, backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md },
    tileNumber: { fontFamily: fonts.extraBold, fontSize: 28, color: colors.textPrimary },
    tileLabel: { ...typography.body, color: colors.textSecondary, marginTop: 2 },
    tileDetail: { ...typography.meta, marginTop: 4 },
    card: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, marginBottom: spacing.lg },
    cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    cardTitle: { ...typography.cardTitle },
    cardTag: { ...typography.meta },
    chartRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: spacing.lg },
    chartCol: { flex: 1, alignItems: 'center' },
    chartTrack: { width: 22, height: CHART_HEIGHT, flexDirection: 'column-reverse', gap: 1, overflow: 'hidden' },
    chartTrackDense: { width: 5 },
    chartSeg: { width: '100%', borderRadius: 2 },
    chartEmpty: { width: '100%', height: 2, backgroundColor: colors.ringTrack },
    chartLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted, marginTop: spacing.sm },
    chartLabelToday: { color: colors.textPrimary },
    legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: 160 },
    legendDot: { width: 8, height: 8, borderRadius: radii.pill },
    legendText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    emptyText: { ...typography.body, color: colors.textSecondary },
    habitCard: { backgroundColor: colors.background, borderRadius: radii.lg, padding: spacing.md, marginTop: spacing.md },
    habitHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
    habitNameWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
    habitName: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary },
    habitKind: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
    habitCount: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary },
    habitSub: { ...typography.meta, marginTop: 4, marginBottom: spacing.sm },
    strip: { gap: STRIP_GAP, marginBottom: spacing.sm },
    stripRow: { flexDirection: 'row', gap: STRIP_GAP },
    cell: { flex: 1, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    cellTall: { flex: 1, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    cellPad: { flex: 1, height: 26 },
    cellSet: { borderWidth: 1.5, borderColor: 'transparent' },
    cellGlass: { borderWidth: 1.5, opacity: 0.95 },
    cellOpen: { borderWidth: 1.5, backgroundColor: 'transparent' },
    cellDashed: { borderWidth: 1.5, borderStyle: 'dashed', backgroundColor: 'transparent' },
    runRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md, marginTop: 2 },
    runText: { ...typography.meta },
    runStrong: { fontFamily: fonts.bold, color: colors.textPrimary },
    shieldNote: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    glassMini: { width: 14, height: 14, borderRadius: 3, borderWidth: 1, alignItems: 'center', justifyContent: 'center', opacity: 0.95 },
    progressTrack: { height: 10, borderRadius: radii.pill, backgroundColor: colors.ringTrack, overflow: 'hidden', marginBottom: spacing.sm },
    progressFill: { height: 10, borderRadius: radii.pill },
    monthBars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: spacing.sm },
    monthCol: { flex: 1, alignItems: 'center' },
    monthTrack: { height: 48, justifyContent: 'flex-end' },
    monthBar: { width: 14, borderRadius: 3 },
    monthLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
    footnote: { ...typography.meta, marginBottom: spacing.lg },
  });
}
