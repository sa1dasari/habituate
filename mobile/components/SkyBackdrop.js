import React from 'react';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { VIEW_H, VIEW_W } from '../utils/skylineScene';

/**
 * Paints the sky behind the skyline (SKYLINE.md section 7, mockup 5). A
 * static two-stop vertical gradient per sky kind — no cloud drift or rain
 * animation here or anywhere else by default, matching "respect Reduce
 * Motion" (section 7/13); an animated variant, if ever added, would need to
 * check reduceMotion itself before animating.
 */
export default function SkyBackdrop({ stops, width = VIEW_W, height = VIEW_H }) {
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
      <Defs>
        <LinearGradient id="skyGradient" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={stops[0]} />
          <Stop offset="1" stopColor={stops[1]} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="url(#skyGradient)" />
    </Svg>
  );
}
