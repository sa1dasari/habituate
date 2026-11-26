import React, { useMemo } from 'react';
import Svg, { Circle, Defs, Ellipse, Line, LinearGradient, Rect, Stop } from 'react-native-svg';
import { VIEW_H, VIEW_W } from '../utils/skylineScene';
import { moonPhase } from '../utils/moonPhase';

/**
 * Paints the sky behind the whole page, not a confined box — the gradient,
 * cloud layers and weather glyph (sun, rain streaks, snow, or moon + stars)
 * fill whatever `width`/`height` the caller passes (SkylineScreen.js passes
 * the full device window), so the look changes with real weather across the
 * entire screen, not just behind the towers. The SVG's own viewBox always
 * matches `width`/`height` 1:1 — icon/star/cloud positions are fractions of
 * that box — so the sun/moon stay circular at any device aspect ratio
 * instead of being stretched to fit a fixed 390x560 coordinate system.
 * Everything here is static — no cloud drift, no falling-rain or
 * falling-snow animation, matching "respect Reduce Motion, show a static
 * sky" (SKYLINE.md section 7/13). `kind` is one of utils/sky.js's
 * SKY_KINDS; `now` is only used for the moon's phase.
 *
 * Boards 94/96 (design/skyline/, owner-approved 2026-11-26): every kind —
 * not just the overcast/rain/snow ones — gets the same 4-cloud layer: two
 * clouds sit behind the translucent header card (SkylineScreen.js renders
 * the card itself at reduced opacity over this backdrop so they show
 * through), one back cloud sits just below the header, above where towers
 * start, and one translucent front cloud drapes over the tallest towers
 * with the towers still visible through it. Rain streaks and snow cover the
 * full screen down near the list sheet, not a cluster in one spot.
 */

// Fixed star field (not Math.random) so the night sky doesn't jitter
// between renders — [xFraction, yFraction, radius] of the box.
const STARS = [
  [0.1, 0.08, 1.4], [0.24, 0.05, 1], [0.35, 0.12, 1.6], [0.46, 0.06, 1], [0.58, 0.1, 1.3],
  [0.69, 0.04, 1], [0.8, 0.08, 1.5], [0.9, 0.14, 1], [0.15, 0.2, 1], [0.38, 0.23, 1.2],
  [0.62, 0.21, 1], [0.77, 0.25, 1.4], [0.05, 0.29, 1], [0.28, 0.32, 1.3], [0.85, 0.32, 1],
  [0.51, 0.36, 1], [0.18, 0.39, 1.2], [0.72, 0.37, 1],
];

// Board 96: one cloud colour per sky kind (not just the overcast/rain/snow
// three) — night's gets its own 70% opacity per the approved spec, applied
// only to the back layer; the front translucent cloud keeps its own ~55%
// regardless of kind.
const CLOUD_LAYER_COLORS = {
  dawn: '#E9A8BD',
  day: '#FFFFFF',
  overcast: '#E4E7EB',
  rain: '#2F3742',
  snow: '#F4F6F8',
  night: '#2B3257',
};

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

function CloudGlyph({ cx, cy, color, scale = 1, opacity = 1 }) {
  return (
    <>
      <Ellipse cx={cx - 20 * scale} cy={cy + 10 * scale} rx={26 * scale} ry={16 * scale} fill={color} opacity={0.9 * opacity} />
      <Ellipse cx={cx + 16 * scale} cy={cy} rx={32 * scale} ry={20 * scale} fill={color} opacity={opacity} />
      <Ellipse cx={cx + 46 * scale} cy={cy + 12 * scale} rx={22 * scale} ry={14 * scale} fill={color} opacity={0.9 * opacity} />
    </>
  );
}

// The universal 4-cloud layer (board 94/96): two behind the header card,
// one back cloud below it (above where towers start), one translucent
// front cloud over the tallest towers. `headerTop`/`headerHeight` place the
// first two relative to the real measured header card, not a guessed
// fraction of the page — a raw height fraction landed clouds on top of the
// header on some devices in an earlier pass of this same fix.
function CloudLayers({ width, headerTop, headerHeight, color, nightDim }) {
  const backOpacity = nightDim ? 0.7 : 1;
  const aboveTowersY = headerTop + headerHeight + 55;
  const overTowersY = aboveTowersY + 110;
  return (
    <>
      <CloudGlyph cx={width * 0.25} cy={headerTop + headerHeight * 0.3} color={color} scale={1} opacity={backOpacity} />
      <CloudGlyph cx={width * 0.72} cy={headerTop + headerHeight * 0.8} color={color} scale={0.85} opacity={backOpacity} />
      <CloudGlyph cx={width * 0.45} cy={aboveTowersY} color={color} scale={0.95} opacity={backOpacity} />
      <CloudGlyph cx={width * 0.6} cy={overTowersY} color={color} scale={1.3} opacity={0.55} />
    </>
  );
}

// Deterministic pseudo-random in [0, 1) from a seed — same reasoning as
// STARS being a fixed array rather than Math.random: it must not jitter
// between renders, just look scattered rather than gridded. Classic
// sine-hash noise, stable for a given seed forever.
function pseudoRandom(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// A fixed field (not Math.random, same reasoning as STARS) spanning the
// full width and reaching down near the list sheet, so rain/snow fill the
// whole skyline instead of stopping at the clouds' own footprint. Positions
// are scattered via pseudoRandom rather than laid out in a column/row grid
// — real rain/snow doesn't fall in neat columns. `mark` draws one streak or
// flake at (x, y, index) — index lets `mark` vary length/size per item.
function fullBleedField({ width, height, top, mark, count = 70 }) {
  const bottom = Math.max(top + 80, height * 0.62);
  const items = [];
  for (let i = 0; i < count; i += 1) {
    const x = pseudoRandom(i * 3.73 + 1.1) * width;
    const y = top + pseudoRandom(i * 7.91 + 4.6) * (bottom - top);
    items.push(mark(x, y, i));
  }
  return items;
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

export default function SkyBackdrop({
  stops,
  kind = 'day',
  now,
  width = VIEW_W,
  height = VIEW_H,
  iconY,
  headerTop = 0,
  headerHeight = 0,
  // Boards 94/96 only cover the Skyline tab — the small night-only sky
  // strips in ShareCard/FriendProfileModal/ChallengeDetailModal/
  // SharedHabitDetailModal never showed clouds before and aren't part of
  // that spec, so the new 4-cloud layer is opt-in. SkylineScreen.js is the
  // only caller that passes `clouds`.
  clouds = false,
}) {
  const date = now instanceof Date ? now : new Date();
  const iconCx = width * 0.78;
  // `iconY` lets the caller place the sun/moon below its own header/chrome
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

  const cloudColor = CLOUD_LAYER_COLORS[kind] || CLOUD_LAYER_COLORS.day;
  // "Below the text boxes" clouds need a measured header position same as
  // the sun/moon; fall back the same way iconCy does if it isn't ready yet.
  const effectiveHeaderTop = headerHeight > 0 ? headerTop : 0;
  const effectiveHeaderHeight = headerHeight > 0 ? headerHeight : height * 0.11;

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
      {/* Clouds (board 94/96) are a Daily-view-only treatment — the Weekly &
          Monthly list starts real content much higher up the page than the
          Daily towers scene does, so the opaque cloud puffs drawn there
          landed on top of habit cards and buttons instead of empty sky.
          Rain/snow themselves are NOT gated the same way (below) — they're
          a background effect, thin enough not to obscure content, and the
          owner wants them filling the whole page in every view. */}
      {clouds && (
        <CloudLayers
          width={width}
          headerTop={effectiveHeaderTop}
          headerHeight={effectiveHeaderHeight}
          color={cloudColor}
          nightDim={kind === 'night'}
        />
      )}
      {/* Rain/snow run from the very top of the page — behind the header
          card, same as the clouds — down near the list sheet, in every
          view (Daily and Weekly & Monthly alike), not just below the
          header. An earlier pass started this field below the header to
          dodge an unrelated cloud-placement bug; that bug is fixed above,
          so the streak field no longer needs to avoid that area either. */}
      {kind === 'rain' &&
        fullBleedField({
          width,
          height,
          top: 16,
          mark: (x, y, key) => {
            const len = 10 + pseudoRandom(key * 2.3 + 9.1) * 8;
            const slope = len * 0.43;
            return (
              <Line
                key={`drop-${key}`}
                x1={x}
                y1={y}
                x2={x - slope}
                y2={y + len}
                stroke="#8FA3B8"
                strokeWidth={2}
                strokeLinecap="round"
              />
            );
          },
        })}
      {kind === 'snow' &&
        fullBleedField({
          width,
          height,
          top: 16,
          mark: (x, y, key) => (
            <Circle key={`flake-${key}`} cx={x} cy={y} r={1.3 + pseudoRandom(key * 1.7 + 3.2) * 1.6} fill="#BCD3E6" />
          ),
        })}
    </Svg>
  );
}
