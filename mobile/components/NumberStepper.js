import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { radii, spacing } from '../theme';

/**
 * +/- buttons for fine adjustment, but the number itself is editable too —
 * a 300-day target shouldn't require 300 taps. Typed text is kept as local
 * state so a mid-edit value like "3" (on the way to "300") isn't clamped or
 * overwritten before the user finishes; it's only parsed/clamped on change
 * (to drive any live preview) and reconciled on blur.
 */
export default function NumberStepper({ value, onChange, min, max, step = 1, label }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

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

  return (
    <View style={styles.stepper}>
      <Pressable
        style={[styles.stepperBtn, value <= min && styles.stepperBtnDisabled]}
        disabled={value <= min}
        hitSlop={8}
        accessibilityLabel={`Decrease ${label}`}
        onPress={() => onChange(Math.max(min, value - step))}
      >
        <MaterialCommunityIcons name="minus" size={18} color={colors.textSecondary} />
      </Pressable>
      <TextInput
        style={styles.stepperValue}
        value={text}
        onChangeText={handleChangeText}
        onBlur={handleBlur}
        keyboardType="number-pad"
        selectTextOnFocus
        accessibilityLabel={`${label}, editable`}
      />
      <Pressable
        style={[styles.stepperBtn, styles.stepperBtnAdd, value >= max && styles.stepperBtnDisabled]}
        disabled={value >= max}
        hitSlop={8}
        accessibilityLabel={`Increase ${label}`}
        onPress={() => onChange(Math.min(max, value + step))}
      >
        <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    stepperBtn: {
      width: 36,
      height: 36,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    stepperBtnAdd: { backgroundColor: colors.accent },
    stepperBtnDisabled: { opacity: 0.4 },
    stepperValue: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textPrimary,
      minWidth: 32,
      textAlign: 'center',
    },
  });
}
