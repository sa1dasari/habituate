import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { HABIT_TEMPLATES } from './TemplateHabitsPicker';
import { fonts } from '../theme';

// Per-template icon + tint, as drawn on design-review board 35. Tints are
// icon-chip decoration only — the tower's own colour still comes from the
// habit's category once created.
const TEMPLATE_LOOK = {
  'Drink water': { icon: 'heart-outline', color: '#EF5B63', bg: 'rgba(239,91,99,0.20)' },
  'Read 10 minutes': { icon: 'book-open-page-variant-outline', color: '#2DD4BF', bg: 'rgba(45,212,191,0.20)' },
  Meditate: { icon: 'meditation', color: '#A78BFA', bg: 'rgba(167,139,250,0.20)' },
  'Go for a walk': { icon: 'dumbbell', color: '#FB923C', bg: 'rgba(251,146,60,0.20)' },
  'Sleep by 11pm': { icon: 'weather-night', color: '#818CF8', bg: 'rgba(129,140,248,0.20)' },
  'Tidy up': { icon: 'home-outline', color: '#C2652A', bg: 'rgba(194,101,42,0.22)' },
};

/**
 * "Lay a foundation" templates screen (design-review board 35, first-run
 * flow): six one-tap starter habits plus Custom. A template creates a
 * once-a-day habit straight away (SkylineScreen's handleAddTemplateHabit);
 * Custom opens the full tower form. Full screen, not a sheet, so it reads as
 * its own step of the first-run flow.
 */
export default function FoundationTemplates({ visible, onClose, onSelectTemplate, onCustom, theme, busy }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={styles.cancelBtn}
            testID="foundation-templates-cancel"
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={[styles.cancelText, { color: theme.muted }]}>Cancel</Text>
          </Pressable>

          <Text style={[styles.title, { color: theme.text }]}>Lay a foundation</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            Pick one to start, or make your own. You can change anything later.
          </Text>

          <View style={styles.grid}>
            {HABIT_TEMPLATES.map((template) => {
              const look = TEMPLATE_LOOK[template.name] || TEMPLATE_LOOK['Tidy up'];
              return (
                <Pressable
                  key={template.name}
                  onPress={() => onSelectTemplate(template)}
                  disabled={busy}
                  style={[styles.tile, { backgroundColor: theme.surfaceLow, opacity: busy ? 0.6 : 1 }]}
                  testID={`foundation-template-${template.name}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${template.name}, lay a foundation`}
                >
                  <View style={[styles.iconChip, { backgroundColor: look.bg }]}>
                    <MaterialCommunityIcons name={look.icon} size={22} color={look.color} />
                  </View>
                  <Text style={[styles.tileText, { color: theme.text }]} numberOfLines={2}>
                    {template.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={onCustom}
            style={[styles.custom, { borderColor: theme.muted }]}
            testID="foundation-template-custom"
            accessibilityRole="button"
            accessibilityLabel="Custom, make your own tower"
          >
            <MaterialCommunityIcons name="pencil-outline" size={18} color={theme.text} />
            <Text style={[styles.customText, { color: theme.text }]}>Custom</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  cancelBtn: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  cancelText: { fontFamily: fonts.semiBold, fontSize: 15 },
  title: { fontFamily: fonts.extraBold, fontSize: 32, marginTop: 8 },
  subtitle: { fontFamily: fonts.regular, fontSize: 15, marginTop: 8, marginBottom: 20, lineHeight: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: '48%',
    minHeight: 108,
    borderRadius: 20,
    padding: 14,
    justifyContent: 'space-between',
  },
  iconChip: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tileText: { fontFamily: fonts.bold, fontSize: 16, marginTop: 10 },
  custom: {
    marginTop: 14,
    minHeight: 60,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  customText: { fontFamily: fonts.bold, fontSize: 16 },
});
