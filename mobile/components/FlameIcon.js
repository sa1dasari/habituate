import * as React from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { flameStopsForStreak } from '../theme';

/**
 * The app's one flame glyph, used everywhere a streak needs a fire icon
 * instead of each spot picking its own MaterialCommunityIcons "fire" glyph.
 * Color scales with streak length (flameStopsForStreak in theme.js) — a
 * fresh streak reads as a small ember, a long one as something worth
 * protecting. Pass an explicit `color` to opt out of the gradient (e.g. to
 * match a fixed state color) and render a flat fill instead.
 */
export default function FlameIcon({ width = 28, height = 28, streak = 0, color = null }) {
  const gradientId = `flame-${React.useId()}`;
  const [from, to] = flameStopsForStreak(streak);

  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      {color ? null : (
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
      )}
      {/* Material Design Icons' verified "fire" glyph path (mdi:fire) — the
          previous hand-typed path data didn't actually trace a flame shape,
          which is why this read as something else entirely. */}
      <Path
        d="M17.66 11.2c-.23-.3-.51-.56-.77-.82c-.67-.6-1.43-1.03-2.07-1.66C13.33 7.26 13 4.85 13.95 3c-.95.23-1.78.75-2.49 1.32c-2.59 2.08-3.61 5.75-2.39 8.9c.04.1.08.2.08.33c0 .22-.15.42-.35.5c-.23.1-.47.04-.66-.12a.6.6 0 0 1-.14-.17c-1.13-1.43-1.31-3.48-.55-5.12C5.78 10 4.87 12.3 5 14.47c.06.5.12 1 .29 1.5c.14.6.41 1.2.71 1.73c1.08 1.73 2.95 2.97 4.96 3.22c2.14.27 4.43-.12 6.07-1.6c1.83-1.66 2.47-4.32 1.53-6.6l-.13-.26c-.21-.46-.77-1.26-.77-1.26m-3.16 6.3c-.28.24-.74.5-1.1.6c-1.12.4-2.24-.16-2.9-.82c1.19-.28 1.9-1.16 2.11-2.05c.17-.8-.15-1.46-.28-2.23c-.12-.74-.1-1.37.17-2.06c.19.38.39.76.63 1.06c.77 1 1.98 1.44 2.24 2.8c.04.14.06.28.06.43c.03.82-.33 1.72-.93 2.27"
        fill={color || `url(#${gradientId})`}
      />
    </Svg>
  );
}
