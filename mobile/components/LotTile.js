import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

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

// `onPress`/`selected`/`disabled` are only used by LotSheet.js's day picker
// — the compact tile never passes them, so a cell there renders identically
// to before. `selected` is sheet-local UI state (which day the "Hold to
// build"/check-ins list below currently points at), deliberately not a
// field on the pure `period.days` data itself. `disabled` marks a real
// calendar day that predates the habit's own creation — same "nothing to
// pick here" treatment as a future day, just for the other end of time.
export function DayCell({ x, y, w, h, color, cell, onPress, selected, showDayNumber, textColor, disabled }) {
  const { level, isToday, isFuture } = cell;
  return (
    <>
      {level === 0 && (isFuture || disabled) ? (
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
      ) : (
        <Rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={3}
          fill={level > 0 ? color : 'rgba(128,128,128,0.25)'}
          opacity={level > 0 ? LEVEL_OPACITY[level] : 1}
        />
      )}
      {isToday && (
        <Rect x={x} y={y} width={w} height={h} rx={3} fill="none" stroke="#FFFFFF" strokeWidth={1.4} />
      )}
      {selected && (
        <Rect x={x - 1.5} y={y - 1.5} width={w + 3} height={h + 3} rx={4} fill="none" stroke={color} strokeWidth={2} />
      )}
      {showDayNumber && (
        <SvgText x={x + w / 2} y={y + h + 11} fontSize={9} fill={textColor || color} textAnchor="middle">
          {cell.dayNum}
        </SvgText>
      )}
      {onPress && !disabled && (
        <Rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill="transparent"
          onPress={onPress}
          accessible
          accessibilityRole="button"
          accessibilityLabel={dayCellAccessibilityLabel(cell, selected, disabled)}
        />
      )}
    </>
  );
}

function dayCellAccessibilityLabel(cell, selected, disabled) {
  const label = new Date(`${cell.dateKey}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
  if (cell.isFuture) return `${label}, not yet`;
  if (disabled) return `${label}, before this habit started`;
  const state = cell.count > 0 ? `${cell.count} check-in${cell.count === 1 ? '' : 's'}` : 'no check-in';
  return `${label}, ${state}${selected ? ', selected' : ''}`;
}

// Exported for LotSheet.js, which draws the same per-day cells at a bigger
// size with weekday/day-number labels around them — the cell geometry and
// coloring stay identical, only the box size and what wraps it differ.
// `width`/`height` (independent of the square `size` LotTile.js's compact
// tile uses) let a caller with more horizontal room than vertical — a
// weekly (1-row) period in LotSheet.js, say — size cells off the available
// width instead of being squeezed down to fit a square no bigger than the
// shortest side needs, which otherwise leaves most of a wide card empty.
export function DayGrid({
  days,
  color,
  size = SIZE,
  width,
  height,
  pad = PAD,
  gap = GAP,
  onPressDay,
  selectedDateKey,
  dayNumbers = false,
  textColor,
  minDateKey,
}) {
  if (days.length === 0) return null;
  const w = width ?? size;
  const h = height ?? size;
  const rows = Math.ceil(days.length / COLS);
  const labelHeight = dayNumbers ? 14 : 0; // room for the day-number text under each row
  const availableW = w - pad * 2;
  const availableH = h - pad * 2;
  const cellSize = Math.min(
    (availableW - gap * (COLS - 1)) / COLS,
    (availableH - gap * (rows - 1) - rows * labelHeight) / rows,
  );
  const gridW = COLS * cellSize + (COLS - 1) * gap;
  const gridH = rows * (cellSize + labelHeight) + (rows - 1) * gap;
  const originX = (w - gridW) / 2;
  const originY = (h - gridH) / 2;

  return (
    <>
      {days.map((cell, i) => {
        const row = Math.floor(i / COLS);
        const col = i % COLS;
        const x = originX + col * (cellSize + gap);
        const y = originY + row * (cellSize + labelHeight + gap);
        const disabled = minDateKey ? cell.dateKey < minDateKey : false;
        return (
          <DayCell
            key={cell.dateKey}
            x={x}
            y={y}
            w={cellSize}
            h={cellSize}
            color={color}
            cell={cell}
            onPress={onPressDay ? () => onPressDay(cell) : undefined}
            selected={selectedDateKey === cell.dateKey}
            showDayNumber={dayNumbers}
            textColor={textColor}
            disabled={disabled}
          />
        );
      })}
    </>
  );
}

// Memoized — a habit row re-renders every time any habit's check-in state
// changes (the optimistic patch in useHabits.js's `patchHabitCheckIns`
// updates the whole `habits` array), but most tiles in the strip didn't
// actually change. Requires the caller to pass a referentially stable
// `onPress` (LotsView.js memoizes one per tile) — a fresh arrow function
// every render would defeat this by always comparing unequal.
const LotTile = React.memo(function LotTile({ period, color, theme, onPress }) {
  const bg = theme.surfaceHigh;
  return (
    <Pressable
      onPress={onPress}
      style={styles.wrap}
      testID={`lot-tile-${period.key}`}
      accessible
      accessibilityRole={onPress ? 'button' : undefined}
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
    </Pressable>
  );
});

export default LotTile;

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
