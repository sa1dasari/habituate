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
      <Path
        d="M12.001 2.25c.22 1.67-.06 2.96-.53 4.02-.77 1.67-1.6 2.54-1.61 4.98-.01 2.66 2.23 4.65 4.2 5.08 1.44.31 2.38-.15 3.02-.98.35-.45.58-.97.58-1.6 0-2.14-1.9-3.36-3.1-4.28-.95-.74-1.72-1.36-1.41-2.74.2-.96.8-1.78 1.5-2.61.36-.44.69-.86.92-1.48C15.39 2.98 13.91 1.47 12 2.25z"
        fill={color || `url(#${gradientId})`}
      />
      <Path
        d="M7.5 11.5c-.2 1.8.2 3.2 1 4.3 1.07 1.46 2.78 2.3 4.5 1.9 1.06-.27 1.9-.91 2.4-1.7.3-.48.46-1.02.46-1.6-.01-2.1-1.72-3.2-2.7-4.04-.9-.75-1.7-1.38-1.43-2.57.18-.88.66-1.63 1.22-2.4C11.8 6.9 8.45 8 7.5 11.5z"
        fill={color || `url(#${gradientId})`}
        opacity={0.9}
      />
    </Svg>
  );
}
