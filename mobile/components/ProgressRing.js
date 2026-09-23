import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useAppTheme } from '../hooks/useAppTheme';
import { gradients } from '../theme';

/**
 * Renders an actual progress arc. `percent` drives the stroke sweep, not just
 * the colour, so the ring reads as progress at a glance on Today and Insights.
 * The stroke is a gradient by default (pass `color` instead of `gradient` to
 * opt out and use a flat fill).
 */
export default function ProgressRing({
  percent = 0,
  size = 96,
  strokeWidth = 10,
  color = null,
  gradient = gradients.accent,
  trackColor = null,
  label,
  caption,
  children,
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const gradientId = React.useId();
  const clamped = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped / 100);
  const center = size / 2;
  const strokePaint = color || `url(#ring-${gradientId})`;

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {color ? null : (
          <Defs>
            <LinearGradient id={`ring-${gradientId}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={gradient[0]} />
              <Stop offset="1" stopColor={gradient[1]} />
            </LinearGradient>
          </Defs>
        )}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor || colors.ringTrack}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={strokePaint}
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

function makeStyles(colors) {
  return StyleSheet.create({
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
}
