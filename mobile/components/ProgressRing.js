import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../theme';

/**
 * Renders an actual progress arc. `percent` drives the stroke sweep, not just
 * the colour, so the ring reads as progress at a glance on Today and Insights.
 */
export default function ProgressRing({
  percent = 0,
  size = 96,
  strokeWidth = 10,
  color = colors.accent,
  trackColor = colors.ringTrack,
  label,
  caption,
  children,
}) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped / 100);
  const center = size / 2;

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>

      <View style={styles.center} pointerEvents="none">
        {children ? (
          children
        ) : (
          <>
            <Text style={[styles.label, { fontSize: size * 0.24 }]}>
              {label != null ? label : `${Math.round(clamped)}%`}
            </Text>
            {caption ? <Text style={styles.caption}>{caption}</Text> : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '800',
    color: colors.textPrimary,
  },
  caption: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
