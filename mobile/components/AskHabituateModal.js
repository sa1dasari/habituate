import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import ConfirmModal from './ConfirmModal';
import Toast from './Toast';
import TourHighlight from './TourHighlight';
import { useAppTheme } from '../hooks/useAppTheme';
import { useConfirm } from '../hooks/useConfirm';
import { useHabits } from '../hooks/useHabits';
import { useToast } from '../hooks/useToast';
import { useTourTarget } from '../hooks/useTourTarget';
import { TOUR_SCOPES, TOUR_TARGETS } from '../constants/onboardingTour';
import { generateCoachStarterQuestions } from '../utils/consistency';
import { fonts, radii, skylineUI, spacing } from '../theme';

// Small, fixed, Gen-Z-punchy reaction set — long-press any bubble (yours or
// the AI's) to pick one. Same set the AI's own server-side heuristic picks
// from when it auto-reacts to your messages, so the chat only ever shows
// these six glyphs no matter who placed them.
const REACTION_EMOJIS = ['🔥', '❤️', '😂', '😮', '👍', '💯'];

/**
 * Ask Habituate (design/Ask Habituate.png) — the AI habit coach that replaces
 * the deleted pattern-detection engine (SKILLS.md Phase 10). Every reply is
 * generated server-side (CoachController), grounded in the user's real
 * check-in stats, never a generic chatbot with no data access. A suggested
 * adjustment is only ever a proposal: the habit itself is untouched until the
 * user taps Confirm, matching the design's "Nothing changes until you
 * confirm" copy and this app's anti-guilt, user-in-control conventions.
 *
 * Full-page modal, same pattern as CalendarModal — this app has no stack
 * navigator wrapping the tab screens.
 */
export default function AskHabituateModal({ visible, onClose, initialQuestion, habits = [] }) {
  const { typography, effectiveMode } = useAppTheme();
  // Skyline look (design-review boards 41/42): the chat uses the skyline UI
  // palette with amber accents instead of the app's blue/green pair.
  const ui = skylineUI[effectiveMode];
  const colors = useMemo(() => ({ ...ui, accent: ui.amber, safe: ui.amber, textMuted: ui.muted }), [ui]);
  const styles = useMemo(() => makeStyles(ui, typography), [ui, typography]);
  const starterQuestions = useMemo(() => generateCoachStarterQuestions(habits), [habits]);

  const { refresh: refreshHabits } = useHabits();
  const tourHeaderRef = useTourTarget(TOUR_TARGETS.MODAL_ASK_HABITUATE_HEADER);
  const { toast, showToast, hideToast } = useToast();
  const { request, confirm, respond } = useConfirm();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [busyMessageId, setBusyMessageId] = useState(null);
  const [pickerFor, setPickerFor] = useState(null);
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

    const localId = `local-${Date.now()}`;
    setInput('');
    setMessages((prev) => [
      ...prev,
      { id: localId, role: 'USER', content: trimmed, createdAt: new Date().toISOString() },
    ]);
    scrollToEnd();
    setSending(true);
    try {
      const { userMessage, assistantMessage } = await api.askCoach(trimmed);
      // Swaps the optimistic local placeholder for the real persisted row
      // (real id + the AI's server-computed reaction) rather than leaving it
      // in place — without this the user bubble can never be reacted to and
      // the AI's auto-reaction on it would never render.
      setMessages((prev) => [
        ...prev.map((m) => (m.id === localId ? userMessage : m)),
        assistantMessage,
      ]);
      scrollToEnd();
    } catch (err) {
      showToast(
        `Ask Habituate couldn't reply — ${err instanceof Error ? err.message : 'Something went wrong — try again.'}`,
        'error'
      );
    } finally {
      setSending(false);
    }
  };

  const updateMessage = (updated) => {
    setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  };

  const toggleReaction = async (message, emoji) => {
    if (typeof message.id === 'string' && message.id.startsWith('local-')) return;
    const nextEmoji = message.userReaction === emoji ? null : emoji;
    setPickerFor(null);
    const previous = message;
    updateMessage({ ...message, userReaction: nextEmoji });
    try {
      const updated = await api.setCoachReaction(message.id, nextEmoji);
      updateMessage(updated);
    } catch (err) {
      updateMessage(previous);
      showToast(`Couldn't react — ${err instanceof Error ? err.message : 'Try again in a moment.'}`, 'error');
    }
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
      showToast(`${fallback} — ${err instanceof Error ? err.message : 'Try again in a moment.'}`, 'error');
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
      showToast(`Couldn't update that — ${err instanceof Error ? err.message : 'Try again in a moment.'}`, 'error');
    } finally {
      setBusyMessageId(null);
    }
  };

  const clearConversation = async () => {
    const ok = await confirm({
      title: 'Clear conversation?',
      message: "This can't be retrieved once cleared.",
      confirmLabel: 'Clear',
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.clearCoachMessages();
      setMessages([]);
    } catch (err) {
      showToast(`Couldn't clear conversation — ${err instanceof Error ? err.message : 'Try again in a moment.'}`, 'error');
    }
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
          <View style={styles.header} ref={tourHeaderRef}>
            <Pressable
              onPress={onClose}
              style={styles.circleBtn}
              testID="ask-habituate-close"
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <MaterialCommunityIcons name="close" size={22} color={ui.text} />
            </Pressable>
            <Text style={styles.title}>Ask Habituate</Text>
            {messages.length > 0 ? (
              <Pressable
                onPress={clearConversation}
                style={styles.circleBtn}
                testID="ask-habituate-clear"
                accessibilityRole="button"
                accessibilityLabel="Clear conversation"
              >
                <MaterialCommunityIcons name="trash-can-outline" size={20} color={ui.text} />
              </Pressable>
            ) : (
              <View style={styles.circleBtn} />
            )}
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.scroll}
            onContentSizeChange={scrollToEnd}
            onScrollBeginDrag={() => setPickerFor(null)}
          >
            {loading ? (
              <ActivityIndicator style={{ marginTop: spacing.xl }} color={ui.amber} />
            ) : null}

            {messages.map((message) =>
              message.role === 'USER' ? (
                <View key={message.id} style={styles.userBubbleRow}>
                  <Pressable
                    onLongPress={() => setPickerFor((prev) => (prev === message.id ? null : message.id))}
                    delayLongPress={300}
                    style={styles.userBubble}
                  >
                    <Text style={styles.userBubbleText}>{message.content}</Text>
                  </Pressable>
                  <ReactionBadges message={message} styles={styles} align="flex-end" />
                  {pickerFor === message.id ? (
                    <ReactionPicker
                      styles={styles}
                      align="flex-end"
                      current={message.userReaction}
                      onPick={(emoji) => toggleReaction(message, emoji)}
                    />
                  ) : null}
                </View>
              ) : (
                <AssistantTurn
                  key={message.id}
                  message={message}
                  styles={styles}
                  colors={colors}
                  busy={busyMessageId === message.id}
                  pickerOpen={pickerFor === message.id}
                  onLongPress={() => setPickerFor((prev) => (prev === message.id ? null : message.id))}
                  onReact={(emoji) => toggleReaction(message, emoji)}
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
                <ActivityIndicator size="small" color={ui.muted} style={{ marginTop: spacing.xs }} />
              </View>
            ) : null}

            {showStarters ? (
              <View style={styles.startersWrap}>
                <View style={styles.emptyIcon}>
                  <MaterialCommunityIcons name="weather-partly-cloudy" size={26} color={ui.amber} />
                </View>
                <Text style={styles.emptyTitle}>Ask about your own days</Text>
                <Text style={styles.emptyBody}>
                  Answers come from your real check-ins. Nothing changes unless you confirm it.
                </Text>
                {starterQuestions.map((q) => (
                  <Pressable
                    key={q}
                    style={styles.starterChip}
                    onPress={() => send(q)}
                    accessibilityRole="button"
                    accessibilityLabel={q}
                  >
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
              placeholderTextColor={ui.muted}
              value={input}
              onChangeText={setInput}
              onFocus={() => setPickerFor(null)}
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
              <MaterialCommunityIcons name="send-outline" size={22} color="#1A1300" />
            </Pressable>
          </View>
          <Text style={styles.disclaimer}>AI suggestions can be imperfect. You're in control.</Text>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <TourHighlight scope={TOUR_SCOPES.ASK_HABITUATE_MODAL} />
      <Toast toast={toast} onHide={hideToast} />
      <ConfirmModal request={request} onRespond={respond} />
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

/**
 * Small emoji chips rendered under a bubble: the AI's auto-reaction to a
 * USER message (showAiReaction, left-most — only a USER row ever carries
 * one) and/or the human's own pick on either role's message. Renders nothing
 * when neither is set.
 */
function ReactionBadges({ message, styles, align, showAiReaction = true }) {
  if (!message.userReaction && !(showAiReaction && message.aiReaction)) return null;
  return (
    <View style={[styles.reactionBadgeRow, { justifyContent: align }]}>
      {showAiReaction && message.aiReaction ? (
        <View style={styles.reactionBadgeAi}>
          <Text style={styles.reactionBadgeEmoji}>{message.aiReaction}</Text>
        </View>
      ) : null}
      {message.userReaction ? (
        <View style={styles.reactionBadgeUser}>
          <Text style={styles.reactionBadgeEmoji}>{message.userReaction}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** The long-press popover: a small row of the fixed emoji set, under the bubble it belongs to. Tapping the already-active one clears it. */
function ReactionPicker({ styles, align, current, onPick }) {
  return (
    <View style={[styles.reactionPickerRow, { alignSelf: align }]}>
      {REACTION_EMOJIS.map((emoji) => (
        <Pressable
          key={emoji}
          onPress={() => onPick(emoji)}
          style={[styles.reactionPickerOption, current === emoji && styles.reactionPickerOptionActive]}
          hitSlop={4}
        >
          <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function AssistantTurn({
  message,
  styles,
  colors,
  busy,
  pickerOpen,
  onLongPress,
  onReact,
  onConfirm,
  onReject,
  onTryAnotherIdea,
}) {
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
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={300}
        style={styles.replyCard}
        accessibilityLabel={`Habituate, AI coach: ${message.content}`}
      >
        <Text style={styles.replyText}>{message.content}</Text>
        {message.groundingLabel ? (
          <View style={styles.citationRow}>
            <MaterialCommunityIcons name="calendar-month-outline" size={14} color={colors.textMuted} />
            <Text style={styles.citationText}>{message.groundingLabel}</Text>
          </View>
        ) : null}
      </Pressable>
      <ReactionBadges message={message} styles={styles} align="flex-start" showAiReaction={false} />
      {pickerOpen ? (
        <ReactionPicker styles={styles} align="flex-start" current={message.userReaction} onPick={onReact} />
      ) : null}

      {hasProposal ? (
        <View style={styles.adjustmentCard}>
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
              <Pressable
                style={styles.confirmBtn}
                onPress={onConfirm}
                disabled={busy}
                testID="coach-proposal-confirm"
                accessibilityRole="button"
              >
                {busy ? <ActivityIndicator color="#1A1300" /> : <Text style={styles.confirmBtnText}>{confirmText}</Text>}
              </Pressable>
              <Pressable
                style={styles.secondaryBtn}
                onPress={onReject}
                disabled={busy}
                testID="coach-proposal-reject"
                accessibilityRole="button"
              >
                <Text style={styles.secondaryBtnText}>{rejectText}</Text>
              </Pressable>
              <Pressable style={styles.tryAnother} onPress={onTryAnotherIdea} disabled={busy} accessibilityRole="button">
                <Text style={styles.tryAnotherText}>Try another idea</Text>
              </Pressable>
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

function makeStyles(ui, typography) {
  const line = 'rgba(128,140,155,0.28)';
  const amberSoft = `${ui.amber}1F`;
  const amberLine = `${ui.amber}59`;
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: ui.background },
    flex: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: line,
    },
    circleBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: ui.surfaceHigh,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { fontFamily: fonts.bold, fontSize: 20, color: ui.text },
    scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: spacing.xl },
    userBubbleRow: { alignItems: 'flex-end', marginBottom: 18 },
    userBubble: {
      backgroundColor: amberSoft,
      borderWidth: 1,
      borderColor: amberLine,
      borderRadius: 22,
      borderBottomRightRadius: 6,
      paddingHorizontal: 18,
      paddingVertical: 14,
      maxWidth: '85%',
    },
    userBubbleText: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 25, color: ui.text },
    reactionBadgeRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
    reactionBadgeUser: {
      backgroundColor: ui.surfaceHigh,
      borderWidth: 1,
      borderColor: line,
      borderRadius: radii.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    reactionBadgeAi: {
      backgroundColor: ui.surfaceHigh,
      borderRadius: radii.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    reactionBadgeEmoji: { fontSize: 14 },
    reactionPickerRow: {
      flexDirection: 'row',
      gap: 2,
      backgroundColor: ui.surfaceHigh,
      borderRadius: radii.pill,
      padding: 4,
      marginTop: spacing.xs,
      borderWidth: 1,
      borderColor: line,
    },
    reactionPickerOption: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.pill,
    },
    reactionPickerOptionActive: { backgroundColor: amberSoft },
    reactionPickerEmoji: { fontSize: 20 },
    assistantTurn: { marginBottom: 18 },
    coachLabelRow: { marginBottom: spacing.sm },
    coachLabel: { fontFamily: fonts.semiBold, fontSize: 12, color: ui.muted, marginBottom: spacing.sm },
    replyCard: {
      backgroundColor: ui.surfaceHigh,
      borderRadius: 22,
      borderBottomLeftRadius: 6,
      paddingHorizontal: 18,
      paddingVertical: 16,
      maxWidth: '88%',
    },
    replyText: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 26, color: ui.text },
    citationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: line,
    },
    citationText: { fontFamily: fonts.regular, fontSize: 12, color: ui.muted },
    adjustmentCard: {
      borderWidth: 1,
      borderColor: line,
      backgroundColor: ui.surfaceLow,
      borderRadius: 22,
      padding: 18,
      marginTop: spacing.md,
      maxWidth: '88%',
    },
    adjustmentTitle: { fontFamily: fonts.bold, fontSize: 18, color: ui.text, marginBottom: 6 },
    adjustmentDescription: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: ui.text, marginBottom: 6 },
    creationMeta: { fontFamily: fonts.semiBold, fontSize: 13, color: ui.muted, marginBottom: 6 },
    adjustmentCaption: { fontFamily: fonts.regular, fontSize: 14, color: ui.muted, marginBottom: spacing.md },
    confirmBtn: {
      backgroundColor: ui.amber,
      borderRadius: 999,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmBtnText: { fontFamily: fonts.bold, fontSize: 17, color: '#1A1300' },
    secondaryBtn: {
      borderWidth: 1,
      borderColor: line,
      borderRadius: 999,
      minHeight: 52,
      marginTop: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryBtnText: { fontFamily: fonts.bold, fontSize: 16, color: ui.text },
    tryAnother: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
    tryAnotherText: { fontFamily: fonts.semiBold, fontSize: 14, color: ui.amber },
    adjustmentStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    adjustmentStatusText: { fontFamily: fonts.semiBold, fontSize: 14, color: ui.muted },
    startersWrap: { marginTop: 4 },
    emptyIcon: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: amberSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    emptyTitle: { fontFamily: fonts.extraBold, fontSize: 28, color: ui.text },
    emptyBody: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: ui.muted, marginTop: 8, marginBottom: 22 },
    starterChip: {
      borderWidth: 1,
      borderColor: line,
      backgroundColor: ui.surfaceLow,
      borderRadius: 26,
      minHeight: 56,
      paddingHorizontal: 18,
      paddingVertical: 14,
      marginBottom: 12,
      justifyContent: 'center',
    },
    starterText: { fontFamily: fonts.regular, fontSize: 16, color: ui.text },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: line,
    },
    input: {
      flex: 1,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: line,
      paddingHorizontal: 20,
      paddingVertical: 14,
      fontFamily: fonts.regular,
      fontSize: 16,
      color: ui.text,
      maxHeight: 110,
    },
    sendBtn: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: ui.amber,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: { opacity: 0.4 },
    disclaimer: {
      textAlign: 'center',
      fontFamily: fonts.regular,
      fontSize: 13,
      color: ui.muted,
      paddingVertical: 10,
    },
  });
}
