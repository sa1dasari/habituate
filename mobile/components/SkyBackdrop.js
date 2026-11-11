import React, { useMemo } from 'react';
import Svg, { Circle, Defs, Ellipse, Line, LinearGradient, Rect, Stop } from 'react-native-svg';
import { VIEW_H, VIEW_W } from '../utils/skylineScene';
import { moonPhase } from '../utils/moonPhase';

/**
 * Paints the sky behind the whole page, not a confined box — the gradient
 * and weather glyph (sun, clouds, rain streaks, snow, or moon + stars) fill
 * whatever `width`/`height` the caller passes (SkylineScreen.js passes the
 * full device window), so the look changes with real weather across the
 * entire screen, not just behind the towers. The SVG's own viewBox always
 * matches `width`/`height` 1:1 — icon/star positions are fractions of that
 * box — so the sun/moon stay circular at any device aspect ratio instead of
 * being stretched to fit a fixed 390x560 coordinate system. Clouds aren't
 * one fixed color: white for snow, grey for overcast, near-black for
 * rain/storm (`cloudColorFor`) — plus a second, smaller drift cloud
 * elsewhere on the sky so a cloudy/rainy/snowy sky reads as more than one
 * blob next to the weather icon. Everything here is static — no cloud
 * drift, no falling-rain or falling-snow animation, matching "respect
 * Reduce Motion, show a static sky" (SKYLINE.md section 7/13). `kind` is
 * one of utils/sky.js's SKY_KINDS; `now` is only used for the moon's phase.
 */

// Fixed star field (not Math.random) so the night sky doesn't jitter
// between renders — [xFraction, yFraction, radius] of the box.
const STARS = [
  [0.1, 0.08, 1.4], [0.24, 0.05, 1], [0.35, 0.12, 1.6], [0.46, 0.06, 1], [0.58, 0.1, 1.3],
  [0.69, 0.04, 1], [0.8, 0.08, 1.5], [0.9, 0.14, 1], [0.15, 0.2, 1], [0.38, 0.23, 1.2],
  [0.62, 0.21, 1], [0.77, 0.25, 1.4], [0.05, 0.29, 1], [0.28, 0.32, 1.3], [0.85, 0.32, 1],
  [0.51, 0.36, 1], [0.18, 0.39, 1.2], [0.72, 0.37, 1],
];

function SunGlyph({ cx, cy, color, glow, rays }) {
  return (
    <>
      <Circle cx={cx} cy={cy} r={34} fill={glow} opacity={0.35} />
      <Circle cx={cx} cy={cy} r={22} fill={color} />
      {rays &&
        [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const x1 = cx + Math.cos(rad) * 30;
          const y1 = cy + Math.sin(rad) * 30;
          const x2 = cx + Math.cos(rad) * 40;
          const y2 = cy + Math.sin(rad) * 40;
          return <Line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2.5} strokeLinecap="round" />;
        })}
    </>
  );
}

// Plain white, grey, or near-black clouds depending on the weather, not one
// fixed color for every cloudy kind — snow's clouds read as light/white,
// overcast as a neutral grey, rain/storm clouds as dark, almost black.
function cloudColorFor(kind) {
  if (kind === 'rain') return '#3B4650';
  if (kind === 'snow') return '#FFFFFF';
  return '#9CA8B5'; // overcast
}

function CloudGlyph({ cx, cy, color, scale = 1, opacity = 1 }) {
  return (
    <>
      <Ellipse cx={cx - 20 * scale} cy={cy + 10 * scale} rx={26 * scale} ry={16 * scale} fill={color} opacity={0.9 * opacity} />
      <Ellipse cx={cx + 16 * scale} cy={cy} rx={32 * scale} ry={20 * scale} fill={color} opacity={opacity} />
      <Ellipse cx={cx + 46 * scale} cy={cy + 12 * scale} rx={22 * scale} ry={14 * scale} fill={color} opacity={0.9 * opacity} />
    </>
  );
}

// A second, smaller cloud cluster elsewhere on the sky so cloudy/rainy/snowy
// kinds read as an actual overcast sky, not a single blob living next to the
// weather icon.
function DriftCloud({ width, height, color }) {
  const cx = width * 0.28;
  const cy = height * 0.2;
  return <CloudGlyph cx={cx} cy={cy} color={color} scale={0.6} opacity={0.75} />;
}

function RainGlyph({ cx, cy, cloudColor, dropColor }) {
  const drops = [];
  for (let col = 0; col < 5; col += 1) {
    for (let row = 0; row < 3; row += 1) {
      const x = cx - 40 + col * 22 + (row % 2) * 6;
      const y = cy + 30 + row * 16;
      drops.push(<Line key={`${col}-${row}`} x1={x} y1={y} x2={x - 5} y2={y + 12} stroke={dropColor} strokeWidth={2} strokeLinecap="round" />);
    }
  }
  return (
    <>
      <CloudGlyph cx={cx} cy={cy} color={cloudColor} />
      {drops}
    </>
  );
}

function SnowGlyph({ cx, cy, cloudColor, flakeColor }) {
  const flakes = [];
  for (let col = 0; col < 5; col += 1) {
    for (let row = 0; row < 3; row += 1) {
      const x = cx - 40 + col * 22 + (row % 2) * 8;
      const y = cy + 32 + row * 16;
      flakes.push(<Circle key={`${col}-${row}`} cx={x} cy={y} r={2} fill={flakeColor} />);
    }
  }
  return (
    <>
      <CloudGlyph cx={cx} cy={cy} color={cloudColor} />
      {flakes}
    </>
  );
}

function MoonGlyph({ cx, cy, color, overlayColor, now }) {
  const { illumination, waxing } = moonPhase(now);
  const radius = 20;
  // Classic two-circle crescent/gibbous approximation: an overlay circle,
  // filled with the sky's own color, slides across the moon disc. Fully
  // covering it at illumination 0 (new) and fully off to the side at
  // illumination 1 (full).
  const offset = radius * 2 * illumination * (waxing ? -1 : 1);
  return (
    <>
      <Circle cx={cx} cy={cy} r={radius + 8} fill={color} opacity={0.15} />
      <Circle cx={cx} cy={cy} r={radius} fill={color} />
      <Circle cx={cx + offset} cy={cy} r={radius + 1} fill={overlayColor} />
    </>
  );
}

export default function SkyBackdrop({ stops, kind = 'day', now, width = VIEW_W, height = VIEW_H, iconY }) {
  const date = now instanceof Date ? now : new Date();
  const iconCx = width * 0.78;
  // `iconY` lets the caller place the icon below its own header/chrome
  // (measured, not guessed) instead of this component falling back to a
  // flat fraction of the full page height, which can sit right behind the
  // header and read as barely visible.
  const iconCy = iconY != null ? iconY : height * 0.11;
  const stars = useMemo(
    () =>
      kind === 'night'
        ? STARS.map(([xf, yf, r], i) => <Circle key={i} cx={xf * width} cy={yf * height} r={r} fill="#FFFFFF" opacity={0.85} />)
        : null,
    [kind, width, height],
  );

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <LinearGradient id="skyGradient" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={stops[0]} />
          <Stop offset="1" stopColor={stops[1]} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#skyGradient)" />
      {kind === 'night' && stars}
      {kind === 'night' && <MoonGlyph cx={iconCx} cy={iconCy} color="#F4F1E8" overlayColor={stops[0]} now={date} />}
      {(kind === 'day' || kind === 'dawn') && (
        <SunGlyph
          cx={iconCx}
          cy={iconCy}
          color={kind === 'day' ? '#FFD873' : '#F2A65A'}
          glow={kind === 'day' ? '#FFE9A8' : '#F5B98A'}
          rays={kind === 'day'}
        />
      )}
      {kind === 'overcast' && <CloudGlyph cx={iconCx} cy={iconCy} color={cloudColorFor(kind)} />}
      {kind === 'rain' && <RainGlyph cx={iconCx} cy={iconCy} cloudColor={cloudColorFor(kind)} dropColor="#8FA3B8" />}
      {kind === 'snow' && <SnowGlyph cx={iconCx} cy={iconCy} cloudColor={cloudColorFor(kind)} flakeColor="#BCD3E6" />}
      {(kind === 'overcast' || kind === 'rain' || kind === 'snow') && (
        <DriftCloud width={width} height={height} color={cloudColorFor(kind)} />
      )}
    </Svg>
  );
}
