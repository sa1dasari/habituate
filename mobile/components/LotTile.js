import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

/**
 * One period's lot (SKYLINE.md section 4a): a rounded square, drawn as a
 * day-by-day heatmap — one small cell per real calendar day (a weekly lot
 * is a single row of 7 weekdays; a monthly lot chunks `period.days` into
 * rows of 7, which lines up with the day-block rule — 1-7/8-14/.../29-end —
 * for free). Each cell's fill tracks that day's own log count (0/1/2/3+,
 * matching concept _screens/2-weekly-monthly.png's legend), a dashed
 * outline marks a day still to come, and a plain white outline marks
 * today — distinct from the tile's own amber border, which means the whole
 * period's target was met.
 * A shielded period draws one plain solid block instead, no cells at all —
 * the same "no texture at all is the signal" rule as a daily Shield Day
 * floor, not a color alone.
 * Below the art: which week/month this lot is (`period.shortLabel`, e.g.
 * "Nov 3" or "Nov"), then the done/target caption.
 */

const SIZE = 76;
const PAD = 6;
const GAP = 3;
const COLS = 7;

// 0/1/2/3-or-more, matching the legend card under the tile list.
const LEVEL_OPACITY = [0, 0.4, 0.7, 1];

function DayCell({ x, y, w, h, color, cell }) {
  const { level, isToday, isFuture } = cell;
  if (level === 0 && isFuture) {
    return (
      <Rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={3}
        fill="none"
        stroke={color}
        strokeWidth={1.2}
        strokeDasharray="3,2"
        opacity={0.6}
      />
    );
  }
  return (
    <>
      <Rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={3}
        fill={level > 0 ? color : 'rgba(128,128,128,0.25)'}
        opacity={level > 0 ? LEVEL_OPACITY[level] : 1}
      />
      {isToday && (
        <Rect x={x} y={y} width={w} height={h} rx={3} fill="none" stroke="#FFFFFF" strokeWidth={1.4} />
      )}
    </>
  );
}

function DayGrid({ days, color }) {
  if (days.length === 0) return null;
  const rows = Math.ceil(days.length / COLS);
  const available = SIZE - PAD * 2;
  const cellSize = Math.min(
    (available - GAP * (COLS - 1)) / COLS,
    (available - GAP * (rows - 1)) / rows,
  );
  const gridW = COLS * cellSize + (COLS - 1) * GAP;
  const gridH = rows * cellSize + (rows - 1) * GAP;
  const originX = (SIZE - gridW) / 2;
  const originY = (SIZE - gridH) / 2;

  return (
    <>
      {days.map((cell, i) => {
        const row = Math.floor(i / COLS);
        const col = i % COLS;
        const x = originX + col * (cellSize + GAP);
        const y = originY + row * (cellSize + GAP);
        return <DayCell key={cell.dateKey} x={x} y={y} w={cellSize} h={cellSize} color={color} cell={cell} />;
      })}
    </>
  );
}

export default function LotTile({ period, color, theme }) {
  const bg = theme.surfaceHigh;
  return (
    <View
      style={styles.wrap}
      testID={`lot-tile-${period.key}`}
      accessible
      accessibilityLabel={period.accessibilityLabel}
    >
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Rect
          x={1}
          y={1}
          width={SIZE - 2}
          height={SIZE - 2}
          rx={14}
          fill={period.shielded ? theme.surfaceHigh : bg}
          stroke={period.met && !period.shielded ? theme.amber : 'transparent'}
          strokeWidth={period.met && !period.shielded ? 2.5 : 0}
        />
        {period.shielded ? (
          // A plain solid block reads as the Shield signal — no inner
          // texture at all, same rule as a daily Shield Day floor.
          <Rect x={10} y={10} width={SIZE - 20} height={SIZE - 20} rx={8} fill={color} opacity={0.35} />
        ) : (
          <DayGrid days={period.days} color={color} />
        )}
      </Svg>
      <Text numberOfLines={1} style={[styles.periodLabel, { color: theme.text }]}>
        {period.shortLabel}
      </Text>
      <Text numberOfLines={1} style={[styles.caption, { color: theme.muted }]}>
        {period.caption}
      </Text>
    </View>
  );
}

/** The static legend card under the tile list (concept _screens/
 * 2-weekly-monthly.png's bottom card) — explains the day-cell color tiers
 * and the three border states, so a reader isn't left guessing what a
 * dashed or white-outlined cell means. */
export function LotLegend({ theme }) {
  return (
    <View style={[styles.legend, { backgroundColor: theme.surfaceHigh }]}>
      <Text style={[styles.legendTitle, { color: theme.muted }]}>Each small square is one day</Text>
      <View style={styles.legendRow}>
        <LegendSwatch level={0} theme={theme} label="None" />
        <LegendSwatch level={1} theme={theme} label="1" />
        <LegendSwatch level={2} theme={theme} label="2" />
        <LegendSwatch level={3} theme={theme} label="3 or more" />
      </View>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { borderColor: theme.amber, borderWidth: 2 }]} />
          <Text style={[styles.legendLabel, { color: theme.muted }]}>Target met</Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendBox,
              { borderColor: theme.muted, borderWidth: 1.2, borderStyle: 'dashed' },
            ]}
          />
          <Text style={[styles.legendLabel, { color: theme.muted }]}>To come</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { borderColor: '#FFFFFF', borderWidth: 1.4 }]} />
          <Text style={[styles.legendLabel, { color: theme.muted }]}>Today</Text>
        </View>
      </View>
    </View>
  );
}

function LegendSwatch({ level, theme, label }) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendBox,
          level === 0
            ? { backgroundColor: 'rgba(128,128,128,0.25)' }
            : { backgroundColor: theme.amber, opacity: LEVEL_OPACITY[level] },
        ]}
      />
      <Text style={[styles.legendLabel, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, alignItems: 'center', marginRight: 10 },
  periodLabel: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  caption: { fontSize: 11, marginTop: 1 },
  legend: { borderRadius: 14, padding: 14, marginTop: 8 },
  legendTitle: { fontSize: 13, marginBottom: 10 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 4 },
  legendBox: { width: 16, height: 16, borderRadius: 4, marginRight: 6 },
  legendLabel: { fontSize: 12 },
});
