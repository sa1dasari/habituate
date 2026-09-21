import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii, shadow, spacing, typography } from '../theme';
import { dateToTimeString, formatTime, timeStringToDate } from '../utils/time';

/**
 * Native time-of-day picker (the iOS wheel / Android clock dialog) instead of
 * free-text entry. `value` and the value passed to `onChange` are both plain
 * "HH:mm" strings — the app's existing scheduledTime format — never a Date.
 *
 * Android's picker is a self-dismissing native dialog; iOS's is an inline
 * spinner with no dismiss affordance of its own, so it's wrapped in a small
 * sheet with Cancel/Done. Both paths converge on the same onChange contract.
 */
export default function TimePicker({ value, onChange, placeholder = 'Set a time', disabled = false }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => timeStringToDate(value));

  const openPicker = () => {
    setDraft(timeStringToDate(value));
    setOpen(true);
  };

  const handleAndroidSelect = (event, selectedDate) => {
    setOpen(false);
    if (selectedDate) {
      onChange(dateToTimeString(selectedDate));
    }
  };

  const confirmIOS = () => {
    onChange(dateToTimeString(draft));
    setOpen(false);
  };

  const cancelIOS = () => setOpen(false);

  return (
    <View style={styles.row}>
      <Pressable
        style={[styles.trigger, disabled && styles.triggerDisabled]}
        onPress={openPicker}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={value ? formatTime(value) : placeholder}
      >
        <Text style={[styles.triggerText, !value && styles.placeholder]} numberOfLines={1}>
          {value ? formatTime(value) : placeholder}
        </Text>
        <MaterialCommunityIcons name="clock-outline" size={20} color={colors.textSecondary} />
      </Pressable>

      {value && !disabled ? (
        <Pressable
          style={styles.clearBtn}
          onPress={() => onChange('')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear time"
        >
          <MaterialCommunityIcons name="close" size={16} color={colors.textMuted} />
        </Pressable>
      ) : null}

      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={draft}
          mode="time"
          display="default"
          onValueChange={handleAndroidSelect}
          onDismiss={() => setOpen(false)}
        />
      ) : null}

      {Platform.OS !== 'android' ? (
        <Modal visible={open} transparent animationType="fade" onRequestClose={cancelIOS}>
          <Pressable style={styles.backdrop} onPress={cancelIOS}>
            <Pressable style={styles.sheet} onPress={() => {}}>
              <View style={styles.sheetHeader}>
                <Pressable onPress={cancelIOS} hitSlop={8}>
                  <Text style={styles.sheetAction}>Cancel</Text>
                </Pressable>
                <Text style={styles.sheetTitle}>Choose a time</Text>
                <Pressable onPress={confirmIOS} hitSlop={8}>
                  <Text style={[styles.sheetAction, styles.sheetActionPrimary]}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={draft}
                mode="time"
                display="spinner"
                onValueChange={(_, selectedDate) => selectedDate && setDraft(selectedDate)}
                style={styles.picker}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  trigger: {
    flex: 1,
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
  triggerDisabled: {
    opacity: 0.5,
  },
  triggerText: {
    fontSize: 15,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  placeholder: {
    color: colors.textMuted,
  },
  clearBtn: {
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17, 24, 39, 0.35)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
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
  sheetTitle: {
    ...typography.label,
  },
  sheetAction: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  sheetActionPrimary: {
    color: colors.accent,
    fontWeight: '700',
  },
  picker: {
    alignSelf: 'stretch',
  },
});
