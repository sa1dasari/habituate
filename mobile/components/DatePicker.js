import React, { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { radii, shadow, spacing } from '../theme';

function parseDateKey(key) {
  if (!key) return new Date();
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDisplay(dateKey) {
  const date = parseDateKey(dateKey);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Native date picker (the iOS wheel / Android calendar dialog), same split
 * as TimePicker — `value`/onChange are "YYYY-MM-DD" strings throughout, never
 * a Date, matching every other date key in this codebase (utils/date.js).
 */
export default function DatePicker({ value, onChange, placeholder = 'Set a date', maximumDate, disabled = false }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => parseDateKey(value));

  const openPicker = () => {
    setDraft(parseDateKey(value));
    setOpen(true);
  };

  const handleAndroidSelect = (event, selectedDate) => {
    setOpen(false);
    if (selectedDate) {
      onChange(toDateKey(selectedDate));
    }
  };

  const confirmIOS = () => {
    onChange(toDateKey(draft));
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
        accessibilityLabel={value ? formatDisplay(value) : placeholder}
      >
        <Text style={[styles.triggerText, !value && styles.placeholder]} numberOfLines={1}>
          {value ? formatDisplay(value) : placeholder}
        </Text>
        <MaterialCommunityIcons name="calendar-outline" size={20} color={colors.textSecondary} />
      </Pressable>

      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={draft}
          mode="date"
          display="default"
          maximumDate={maximumDate}
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
                <Text style={styles.sheetTitle}>Choose a date</Text>
                <Pressable onPress={confirmIOS} hitSlop={8}>
                  <Text style={[styles.sheetAction, styles.sheetActionPrimary]}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={draft}
                mode="date"
                display="spinner"
                maximumDate={maximumDate}
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

function makeStyles(colors, typography) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
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
    triggerDisabled: { opacity: 0.5 },
    triggerText: { fontSize: 15, color: colors.textPrimary, flexShrink: 1 },
    placeholder: { color: colors.textMuted },
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17, 24, 39, 0.35)' },
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
    sheetTitle: { ...typography.label },
    sheetAction: { fontSize: 15, color: colors.textSecondary },
    sheetActionPrimary: { color: colors.accent, fontWeight: '700' },
    picker: { alignSelf: 'stretch' },
  });
}
