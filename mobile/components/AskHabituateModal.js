import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../api/client';
import { useAppTheme } from '../hooks/useAppTheme';
import { useHabits } from '../hooks/useHabits';
import { generateCoachStarterQuestions } from '../utils/consistency';
import { radii, shadow, spacing } from '../theme';

/**
 * Ask Habituate (design/Ask Habituate.png) — the AI habit coach that replaces
 * the deleted pattern-detection engine (SKILLS.md Phase 10). Every reply is
 * generated server-side (CoachController), grounded in the user's real
 * check-in stats, never a generic chatbot with no data access. A suggested
 * adjustment is only ever a proposal: the habit itself is untouched until the
 * user taps Confirm, matching the design's "Nothing changes until you
 * confirm" copy and this app's anti-guilt, user-in-control conventions.
 *
 * Full-page modal, same pattern as CalendarModal/ConsistencyDetailModal —
 * this app has no stack navigator wrapping the tab screens.
 */
export default function AskHabituateModal({ visible, onClose, initialQuestion, habits = [] }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const starterQuestions = useMemo(() => generateCoachStarterQuestions(habits), [habits]);

  const { refresh: refreshHabits } = useHabits();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [busyMessageId, setBusyMessageId] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    api
      .listCoachMessages()
      .then((list) => {
        if (cancelled) return;
        const existing = list || [];
        setMessages(existing);
        // Always send a tapped suggested question, even into an existing
        // conversation — this used to only fire for a brand-new (empty)
        // thread, so it silently did nothing once you'd chatted before.
        if (initialQuestion) {
          send(initialQuestion);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const scrollToEnd = () => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  const send = async (content) => {
    const trimmed = (content || '').trim();
    if (!trimmed || sending) return;

    setInput('');
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: 'USER', content: trimmed, createdAt: new Date().toISOString() },
    ]);
    scrollToEnd();
    setSending(true);
    try {
      const reply = await api.askCoach(trimmed);
      setMessages((prev) => [...prev, reply]);
      scrollToEnd();
    } catch (err) {
      Alert.alert(
        "Ask Habituate couldn't reply",
        err instanceof Error ? err.message : 'Something went wrong — try again.'
      );
    } finally {
      setSending(false);
    }
  };

  const updateMessage = (updated) => {
    setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  };

  const confirmProposal = async (message) => {
    setBusyMessageId(message.id);
    try {
      const updated = await api.confirmCoachProposal(message.id);
      updateMessage(updated);
      // The backend just created or mutated a habit — without this, every
      // other screen (Habits, Today, this card's own starter questions)
      // keeps showing stale data from useHabits()'s shared cache until some
      // unrelated action happens to trigger a refetch.
      await refreshHabits();
    } catch (err) {
      const fallback = message.proposalType === 'CREATE_HABIT' ? "Couldn't create that" : "Couldn't apply that";
      Alert.alert(fallback, err instanceof Error ? err.message : 'Try again in a moment.');
    } finally {
      setBusyMessageId(null);
    }
  };

  const rejectProposal = async (message) => {
    setBusyMessageId(message.id);
    try {
      const updated = await api.rejectCoachProposal(message.id);
      updateMessage(updated);
    } catch (err) {
      Alert.alert("Couldn't update that", err instanceof Error ? err.message : 'Try again in a moment.');
    } finally {
      setBusyMessageId(null);
    }
  };

  const clearConversation = () => {
    Alert.alert(
      'Clear conversation?',
      "This can't be retrieved once cleared.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.clearCoachMessages();
              setMessages([]);
            } catch (err) {
              Alert.alert("Couldn't clear conversation", err instanceof Error ? err.message : 'Try again in a moment.');
            }
          },
        },
      ]
    );
  };

  const showStarters = !loading && messages.length === 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <View style={styles.topRow}>
            <Pressable onPress={onClose} hitSlop={12} style={styles.backLink}>
              <MaterialCommunityIcons name="chevron-left" size={20} color={colors.textSecondary} />
              <Text style={styles.backLinkText}>Insights</Text>
            </Pressable>
            {messages.length > 0 ? (
              <Pressable
                onPress={clearConversation}
                hitSlop={12}
                style={styles.clearBtn}
                accessibilityRole="button"
                accessibilityLabel="Clear conversation"
              >
                <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.titleRow}>
            <View style={styles.titleIcon}>
              <MaterialCommunityIcons name="chart-bar" size={20} color={colors.safe} />
            </View>
            <View>
              <Text style={styles.title}>Ask Habituate</Text>
              <Text style={styles.subtitle}>Your AI habit coach</Text>
            </View>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.scroll}
            onContentSizeChange={scrollToEnd}
          >
            {loading ? (
              <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.accent} />
            ) : null}

            {messages.map((message) =>
              message.role === 'USER' ? (
                <View key={message.id} style={styles.userBubbleRow}>
                  <View style={styles.userBubble}>
                    <Text style={styles.userBubbleText}>{message.content}</Text>
                  </View>
                </View>
              ) : (
                <AssistantTurn
                  key={message.id}
                  message={message}
                  styles={styles}
                  colors={colors}
                  busy={busyMessageId === message.id}
                  onConfirm={() => confirmProposal(message)}
                  onReject={() => rejectProposal(message)}
                  onTryAnotherIdea={() =>
                    send(
                      message.proposalType === 'CREATE_HABIT'
                        ? 'Can you suggest a different habit instead?'
                        : 'Can you suggest a different adjustment instead?'
                    )
                  }
                />
              )
            )}

            {sending ? (
              <View style={styles.coachLabelRow}>
                <Text style={styles.coachLabel}>Habituate · AI coach</Text>
                <ActivityIndicator size="small" color={colors.textMuted} style={{ marginTop: spacing.xs }} />
              </View>
            ) : null}

            {showStarters ? (
              <View style={styles.startersWrap}>
                <Text style={styles.startersLabel}>Suggested questions</Text>
                {starterQuestions.map((q, i) => (
                  <Pressable key={q} style={styles.starterChip} onPress={() => send(q)}>
                    <View style={styles.starterNumber}>
                      <Text style={styles.starterNumberText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.starterText}>{q}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              placeholder="Ask about your routine..."
              placeholderTextColor={colors.textMuted}
              value={input}
              onChangeText={setInput}
              editable={!sending}
              multiline
              onSubmitEditing={() => send(input)}
            />
            <Pressable
              style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
              onPress={() => send(input)}
              disabled={!input.trim() || sending}
              accessibilityRole="button"
              accessibilityLabel="Send"
            >
              <MaterialCommunityIcons name="arrow-up" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
          <Text style={styles.disclaimer}>AI suggestions can be imperfect. You're in control.</Text>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

/** e.g. "Fitness · Daily · Count-based" — a compact summary of what will actually be created. */
function creationMetaLabel(creationHabit) {
  if (!creationHabit) return '';
  const parts = [];
  if (creationHabit.category) parts.push(creationHabit.category);
  if (creationHabit.cadenceTarget) {
    parts.push(creationHabit.cadenceTarget === 1 ? 'Daily' : `${creationHabit.cadenceTarget}x/day`);
  }
  if (creationHabit.weeklyTarget) parts.push(`${creationHabit.weeklyTarget}x/week`);
  if (creationHabit.monthlyTarget) parts.push(`${creationHabit.monthlyTarget}x/month`);
  if (creationHabit.trackingMode === 'COUNT') parts.push('Count-based');
  return parts.join(' · ');
}

function AssistantTurn({ message, styles, colors, busy, onConfirm, onReject, onTryAnotherIdea }) {
  const isCreation = message.proposalType === 'CREATE_HABIT';
  const hasProposal = Boolean(message.proposalType);
  const status = message.adjustmentStatus;

  const eyebrowIcon = isCreation ? 'plus-circle-outline' : 'sprout-outline';
  const eyebrowText = isCreation ? 'A habit to try' : 'A small step to try';
  const confirmText = isCreation ? 'Create habit' : 'Confirm adjustment';
  const rejectText = isCreation ? 'Not now' : 'Keep my goal';
  const confirmedText = isCreation ? 'Habit created' : 'Adjustment applied';
  const rejectedText = isCreation ? 'Not created' : 'Kept your current goal';

  return (
    <View style={styles.assistantTurn}>
      <Text style={styles.coachLabel}>Habituate · AI coach</Text>

      <View style={styles.replyCard}>
        <Text style={styles.replyText}>{message.content}</Text>
        {message.groundingLabel ? (
          <View style={styles.citationRow}>
            <MaterialCommunityIcons name="calendar-month-outline" size={14} color={colors.textMuted} />
            <Text style={styles.citationText}>{message.groundingLabel}</Text>
          </View>
        ) : null}
      </View>

      {hasProposal ? (
        <View style={styles.adjustmentCard}>
          <View style={styles.adjustmentEyebrowRow}>
            <MaterialCommunityIcons name={eyebrowIcon} size={16} color={colors.safe} />
            <Text style={styles.adjustmentEyebrow}>{eyebrowText}</Text>
          </View>
          <Text style={styles.adjustmentTitle}>{message.adjustmentTitle}</Text>
          <Text style={styles.adjustmentDescription}>{message.adjustmentDescription}</Text>
          {isCreation && creationMetaLabel(message.creationHabit) ? (
            <Text style={styles.creationMeta}>{creationMetaLabel(message.creationHabit)}</Text>
          ) : null}

          {status === 'PENDING' ? (
            <>
              <Text style={styles.adjustmentCaption}>
                {isCreation ? 'Nothing is created until you confirm.' : 'Nothing changes until you confirm.'}
              </Text>
              <Pressable style={styles.confirmBtn} onPress={onConfirm} disabled={busy}>
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.confirmBtnText}>{confirmText}</Text>}
              </Pressable>
              <View style={styles.secondaryRow}>
                <Pressable style={styles.secondaryBtn} onPress={onTryAnotherIdea} disabled={busy}>
                  <Text style={styles.secondaryBtnText}>Try another idea</Text>
                </Pressable>
                <Pressable style={styles.secondaryBtn} onPress={onReject} disabled={busy}>
                  <Text style={styles.secondaryBtnText}>{rejectText}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.adjustmentStatusRow}>
              <MaterialCommunityIcons
                name={status === 'CONFIRMED' ? 'check-circle' : 'information-outline'}
                size={16}
                color={status === 'CONFIRMED' ? colors.safe : colors.textMuted}
              />
              <Text style={styles.adjustmentStatusText}>
                {status === 'CONFIRMED' ? confirmedText : rejectedText}
              </Text>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(colors, typography) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    backLink: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    backLinkText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
    clearBtn: {
      width: 30,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
    titleIcon: {
      width: 40,
      height: 40,
      borderRadius: radii.md,
      backgroundColor: colors.safeSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { ...typography.sectionTitle, fontSize: 20 },
    subtitle: { ...typography.meta, marginTop: 2 },
    scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
    userBubbleRow: { alignItems: 'flex-end', marginBottom: spacing.lg },
    userBubble: {
      backgroundColor: colors.accentSoft,
      borderRadius: radii.lg,
      borderBottomRightRadius: radii.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      maxWidth: '85%',
    },
    userBubbleText: { fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
    assistantTurn: { marginBottom: spacing.lg },
    coachLabelRow: { marginBottom: spacing.sm },
    coachLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.sm },
    replyCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.md,
      ...shadow,
    },
    replyText: { fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
    citationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    citationText: { fontSize: 11, color: colors.textMuted },
    adjustmentCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.md,
      marginTop: spacing.sm,
      ...shadow,
    },
    adjustmentEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
    adjustmentEyebrow: { fontSize: 12, fontWeight: '700', color: colors.safe },
    adjustmentTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
    adjustmentDescription: { ...typography.body, color: colors.textSecondary, marginBottom: 4 },
    creationMeta: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 4 },
    adjustmentCaption: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.md },
    confirmBtn: {
      backgroundColor: colors.safe,
      borderRadius: radii.pill,
      paddingVertical: spacing.sm + 2,
      alignItems: 'center',
    },
    confirmBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
    secondaryRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    secondaryBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.pill,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    secondaryBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    adjustmentStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    adjustmentStatusText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    startersWrap: { marginTop: spacing.md },
    startersLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: spacing.sm },
    starterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    starterNumber: {
      width: 22,
      height: 22,
      borderRadius: radii.pill,
      backgroundColor: colors.safeSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    starterNumberText: { fontSize: 12, fontWeight: '700', color: colors.safe },
    starterText: { fontSize: 14, color: colors.textPrimary, flex: 1 },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    input: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      fontSize: 14,
      color: colors.textPrimary,
      maxHeight: 100,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: radii.pill,
      backgroundColor: colors.safe,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: { opacity: 0.4 },
    disclaimer: {
      textAlign: 'center',
      fontSize: 11,
      color: colors.textMuted,
      paddingVertical: spacing.sm,
    },
  });
}
