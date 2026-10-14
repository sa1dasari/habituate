import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { radii, shadow, spacing } from '../theme';

/**
 * A tap-to-open bottom-sheet dropdown, same trigger/sheet shape as
 * DatePicker — a single list of options, not a native OS picker, so it
 * looks and feels consistent across iOS/Android like the rest of this app.
 * `options` is an array of plain strings; `value` is the currently selected
 * one (or null/undefined for "nothing selected").
 */
export default function SelectField({ value, onChange, options, placeholder = 'Select', title = 'Choose' }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const [open, setOpen] = useState(false);

  const handleSelect = (option) => {
    onChange(option);
    setOpen(false);
  };

  return (
    <View>
      <Pressable
        style={styles.trigger}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={value || placeholder}
      >
        <Text style={[styles.triggerText, !value && styles.placeholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textSecondary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Text style={styles.sheetAction}>Close</Text>
              </Pressable>
            </View>
            <ScrollView>
              {options.map((option) => {
                const active = option === value;
                return (
                  <Pressable
                    key={option}
                    style={styles.optionRow}
                    onPress={() => handleSelect(option)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>{option}</Text>
                    {active ? <MaterialCommunityIcons name="check" size={20} color={colors.accent} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function makeStyles(colors, typography) {
  return StyleSheet.create({
    trigger: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md - 2,
    },
    triggerText: { fontSize: 15, color: colors.textPrimary, flexShrink: 1 },
    placeholder: { color: colors.textMuted },
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17, 24, 39, 0.35)' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii.lg,
      borderTopRightRadius: radii.lg,
      maxHeight: '60%',
      paddingBottom: spacing.xl,
      ...shadow,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sheetTitle: { ...typography.label },
    sheetAction: { fontSize: 15, color: colors.textSecondary },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    optionText: { fontSize: 15, color: colors.textPrimary },
    optionTextActive: { color: colors.accent, fontWeight: '700' },
  });
}
