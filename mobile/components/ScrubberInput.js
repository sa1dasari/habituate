import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { radii, spacing } from '../theme';

// How much horizontal drag (in px) a full min..max sweep should take, before
// scaling by range — kept inside [MIN_PX_PER_UNIT, MAX_PX_PER_UNIT] so neither
// a tiny range (0-3) nor a huge one (1-365) becomes uncontrollable.
const TARGET_SWEEP_PX = 240;
const MIN_PX_PER_UNIT = 3;
const MAX_PX_PER_UNIT = 40;
// A touch has to move this many px before it's treated as a drag rather than
// a tap-to-type — lets the TextInput underneath still get focus normally.
const DRAG_CLAIM_THRESHOLD = 4;

/**
 * The one fine-tune numeric control for this app, replacing every +/- stepper
 * (per the user's explicit "one design throughout the app" decision) — press
 * and drag left/right to scrub the value, with a light haptic tick on every
 * step and a firmer one at min/max. The number itself is still a real
 * TextInput: a plain tap types a precise value directly (e.g. "365") instead
 * of requiring hundreds of drag-steps, exactly like NumberStepper before it.
 */
export default function ScrubberInput({ value, onChange, min, max, step = 1, label }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [text, setText] = useState(String(value));
  const [dragging, setDragging] = useState(false);

  // PanResponder's handlers are created once (via the useRef below) and would
  // otherwise close over the first render's value/onChange forever — refs
  // keep every handler reading the latest ones.
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const dragStartValueRef = useRef(value);
  const lastHapticValueRef = useRef(value);
  const boundsHapticFiredRef = useRef(false);

  useEffect(() => {
    valueRef.current = value;
    setText(String(value));
  }, [value]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const range = Math.max(1, max - min);
  const pxPerUnit = Math.min(MAX_PX_PER_UNIT, Math.max(MIN_PX_PER_UNIT, TARGET_SWEEP_PX / (range / step)));

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > DRAG_CLAIM_THRESHOLD,
      onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dx) > DRAG_CLAIM_THRESHOLD,
      onPanResponderGrant: () => {
        dragStartValueRef.current = valueRef.current;
        lastHapticValueRef.current = valueRef.current;
        boundsHapticFiredRef.current = false;
        setDragging(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      },
      onPanResponderMove: (_, gesture) => {
        const deltaSteps = Math.round(gesture.dx / pxPerUnit);
        const next = Math.min(max, Math.max(min, dragStartValueRef.current + deltaSteps * step));
        if (next !== valueRef.current) {
          valueRef.current = next;
          onChangeRef.current(next);
        }
        if (next !== lastHapticValueRef.current) {
          lastHapticValueRef.current = next;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          boundsHapticFiredRef.current = false;
        } else if ((next === min || next === max) && !boundsHapticFiredRef.current) {
          boundsHapticFiredRef.current = true;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        }
      },
      onPanResponderRelease: () => setDragging(false),
      onPanResponderTerminate: () => setDragging(false),
    })
  ).current;

  const handleChangeText = (next) => {
    setText(next);
    const n = parseInt(next, 10);
    if (Number.isFinite(n) && n >= min && n <= max) {
      onChange(n);
    }
  };

  const handleBlur = () => {
    const n = parseInt(text, 10);
    const clamped = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : value;
    onChange(clamped);
    setText(String(clamped));
  };

  const fillPercent = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <View style={styles.wrap} {...panResponder.panHandlers}>
      <View style={styles.row}>
        <MaterialCommunityIcons name="chevron-left" size={16} color={colors.textMuted} />
        <TextInput
          style={[styles.value, dragging && styles.valueDragging]}
          value={text}
          onChangeText={handleChangeText}
          onBlur={handleBlur}
          keyboardType="number-pad"
          selectTextOnFocus
          accessibilityLabel={`${label}, editable, or press and drag to adjust`}
        />
        <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textMuted} />
      </View>
      <View style={styles.track}>
        <View style={[styles.trackFill, { width: `${fillPercent}%` }]} />
      </View>
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    wrap: { minWidth: 110 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    value: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary,
      minWidth: 44,
      textAlign: 'center',
      paddingVertical: 2,
    },
    valueDragging: { color: colors.accent },
    track: {
      height: 4,
      borderRadius: radii.pill,
      backgroundColor: colors.ringTrack,
      overflow: 'hidden',
      marginTop: 4,
    },
    trackFill: {
      height: '100%',
      borderRadius: radii.pill,
      backgroundColor: colors.accent,
    },
  });
}
