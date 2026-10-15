import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { spacing } from '../theme';

const GAP_DEGREES = 4;
const MIN_RING_THICKNESS = 9;
const MAX_RING_THICKNESS = 18;
const RING_SPACING = 4;

function polarToCartesian(cx, cy, r, angleDeg) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

/** Standard "describe an SVG arc" helper — the start/end swap plus sweep-flag
 * 0 is the well-known trick for drawing a clockwise arc from startAngle to
 * endAngle (angles measured clockwise from 12 o'clock, via polarToCartesian's
 * own -90° offset). */
function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

/**
 * Tree-ring-style radial consistency chart — replaces the grouped bar chart
 * in ConsistencyDetailModal.js once 2+ habits are selected (a bar chart gets
 * crowded fast once there are several color-coded groups per column;
 * concentric rings scale better and read more like an at-a-glance pattern).
 *
 * The circle is divided into one angular wedge per period bucket (oldest at
 * the top, moving clockwise — same left-to-right-becomes-clockwise ordering
 * as the bar chart's columns), and each selected habit gets its own ring
 * lane at a fixed radius (innermost = first selected) — the same "concentric
 * rings/arcs" technique already used by ConsistencyRing/FlameIcon, per this
 * app's rule of extending the existing visual system rather than inventing a
 * new one. A wedge "lights up" (full opacity) when that bucket's completion
 * ratio is 1, dims proportionally for a partial bucket, and sits at a bare
 * track-only opacity when the bucket has no graded window at all (habit
 * didn't exist yet).
 */
export default function TreeRingChart({
  selectedHistories = [],
  colorSets = [],
  trackColor = '#E5E7EB',
  labelColor = '#9CA3AF',
  size = 260,
}) {
  const bucketCount = selectedHistories[0]?.history.buckets.length || 0;
  const bucketLabels = selectedHistories[0]?.history.buckets.map((b) => b.label) || [];
  const numRings = selectedHistories.length;

  const cx = size / 2;
  const cy = size / 2;
  const labelRadius = size / 2 - 6;
  const outerRadius = size / 2 - 26;
  const innerRadius = 22;
  const available = Math.max(0, outerRadius - innerRadius);
  const ringThickness =
    numRings > 0
      ? Math.min(MAX_RING_THICKNESS, Math.max(MIN_RING_THICKNESS, available / numRings - RING_SPACING))
      : MIN_RING_THICKNESS;

  const perWedge = bucketCount > 0 ? 360 / bucketCount : 0;
  const arcSpan = Math.max(0, perWedge - GAP_DEGREES);

  const rings = useMemo(
    () =>
      selectedHistories.map(({ history }, ringIndex) => {
        const radius = Math.max(innerRadius, outerRadius - ringIndex * (ringThickness + RING_SPACING));
        const wedges = history.buckets.map((bucket, i) => {
          const ratio = bucket.windowLen > 0 ? Math.min(1, bucket.value / bucket.windowLen) : null;
          const startAngle = i * perWedge + GAP_DEGREES / 2;
          const endAngle = startAngle + arcSpan;
          return { ratio, startAngle, endAngle };
        });
        return { radius, wedges };
      }),
    [selectedHistories, outerRadius, innerRadius, ringThickness, perWedge, arcSpan]
  );

  return (
    <View style={styles.wrap}>
      <Svg width={size} height={size}>
        {rings.map((ring, ringIndex) => {
          const color = colorSets[ringIndex % colorSets.length]?.[1] || trackColor;
          return (
            <React.Fragment key={ringIndex}>
              <Circle
                cx={cx}
                cy={cy}
                r={ring.radius}
                stroke={trackColor}
                strokeWidth={ringThickness}
                fill="none"
                opacity={0.5}
              />
              {ring.wedges.map((wedge, wedgeIndex) => {
                if (wedge.ratio === null) return null;
                const opacity = wedge.ratio === 0 ? 0.12 : 0.35 + wedge.ratio * 0.65;
                return (
                  <Path
                    key={wedgeIndex}
                    d={describeArc(cx, cy, ring.radius, wedge.startAngle, wedge.endAngle)}
                    stroke={color}
                    strokeWidth={ringThickness}
                    strokeLinecap="round"
                    fill="none"
                    opacity={opacity}
                  />
                );
              })}
            </React.Fragment>
          );
        })}

        {bucketLabels.map((label, i) => {
          const midAngle = i * perWedge + perWedge / 2;
          const { x, y } = polarToCartesian(cx, cy, labelRadius, midAngle);
          return (
            <SvgText
              key={i}
              x={x}
              y={y}
              fontSize={10}
              fontWeight="600"
              fill={labelColor}
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', marginVertical: spacing.sm },
});
