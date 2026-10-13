import React, { useMemo } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import StackHeader from '../components/StackHeader';
import { useAppTheme } from '../hooks/useAppTheme';
import { radii, shadow, spacing } from '../theme';

const FAQS = [
  {
    question: 'How do streak freezes work?',
    answer: 'Shared Habit groups automatically get a streak freeze if the day is missed, as long as one hasn\'t been used in the last 30 days — no action needed.',
  },
  {
    question: 'Can I undo a check-in?',
    answer: 'Yes — tap the check-in again, or use the calendar view on a habit to remove a specific day.',
  },
  {
    question: 'How do I get my data out?',
    answer: 'Account Settings → Privacy has JSON and CSV export buttons for all your habits, check-ins, and goals.',
  },
  {
    question: 'Ask Habituate gave me a suggestion — what happens if I confirm it?',
    answer: 'Only the exact change shown in the card is applied, and only once you tap Confirm — nothing changes automatically.',
  },
];

// TODO: confirm the real support inbox before store submission.
const SUPPORT_EMAIL = 'support@habituate.app';

export default function GetHelpScreen({ navigation }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);

  const handleContact = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Habituate%20help`).catch(() => {
      Alert.alert("Couldn't open email", `Reach us directly at ${SUPPORT_EMAIL}.`);
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StackHeader title="Get Help" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          {FAQS.map((faq, index) => (
            <View key={faq.question} style={[styles.faqRow, index === FAQS.length - 1 && styles.faqRowLast]}>
              <Text style={styles.question}>{faq.question}</Text>
              <Text style={styles.answer}>{faq.answer}</Text>
            </View>
          ))}
        </View>

        <Pressable style={styles.secondaryButton} onPress={handleContact}>
          <MaterialCommunityIcons name="email-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.secondaryButtonText}>Contact us</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors, typography) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    container: { padding: spacing.lg, paddingBottom: spacing.xxl },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      ...shadow,
    },
    faqRow: { marginBottom: spacing.lg },
    faqRowLast: { marginBottom: 0 },
    question: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xs },
    answer: { ...typography.body, color: colors.textSecondary },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: colors.surface,
      borderRadius: radii.pill,
      paddingVertical: spacing.sm + 2,
      ...shadow,
    },
    secondaryButtonText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  });
}
