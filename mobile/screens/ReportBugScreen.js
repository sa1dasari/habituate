import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import StackHeader from '../components/StackHeader';
import Toast from '../components/Toast';
import api from '../api/client';
import { useAppTheme } from '../hooks/useAppTheme';
import { useToast } from '../hooks/useToast';
import { uploadFeedbackAttachment } from '../utils/uploadAttachment';
import { radii, shadow, spacing } from '../theme';

const TYPES = [
  { value: 'BUG', label: 'Bug' },
  { value: 'SUGGESTION', label: 'Suggestion' },
];

// Free text sent to the backend, not a fixed enum — these just cover the
// app's actual screens so reporters don't have to type it out.
const PAGES = ['Today', 'Habits', 'Insights', 'Community', 'Profile', 'Account Settings', 'Login / Sign up', 'Other'];

const MAX_ATTACHMENTS = 5;

let attachmentKeySeq = 0;
function nextAttachmentKey() {
  attachmentKeySeq += 1;
  return `attachment-${attachmentKeySeq}`;
}

export default function ReportBugScreen({ navigation }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const [type, setType] = useState('BUG');
  const [page, setPage] = useState(null);
  const [message, setMessage] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [attachments, setAttachments] = useState([]); // [{ key, name, uri, mimeType, status: 'uploading'|'done'|'error', url, error }]
  const [submitting, setSubmitting] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  const uploadingCount = attachments.filter((a) => a.status === 'uploading').length;
  const canAddMore = attachments.length < MAX_ATTACHMENTS;

  const startUpload = (item) => {
    setAttachments((prev) => [...prev, item]);
    uploadFeedbackAttachment({ uri: item.uri, name: item.name, mimeType: item.mimeType })
      .then((url) => {
        setAttachments((prev) => prev.map((a) => (a.key === item.key ? { ...a, status: 'done', url } : a)));
      })
      .catch((err) => {
        setAttachments((prev) =>
          prev.map((a) =>
            a.key === item.key
              ? { ...a, status: 'error', error: err instanceof Error ? err.message : 'Upload failed' }
              : a
          )
        );
      });
  };

  const handleAddPhoto = async () => {
    if (!canAddMore) {
      showToast(`You can attach up to ${MAX_ATTACHMENTS} files.`, 'info');
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast('Allow photo access to attach a screenshot.', 'info');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_ATTACHMENTS - attachments.length,
      quality: 0.8,
    });
    if (result.canceled) return;
    for (const asset of result.assets || []) {
      startUpload({
        key: nextAttachmentKey(),
        name: asset.fileName || `photo-${Date.now()}.jpg`,
        uri: asset.uri,
        mimeType: asset.mimeType || 'image/jpeg',
        status: 'uploading',
      });
    }
  };

  const handleAddDocument = async () => {
    if (!canAddMore) {
      showToast(`You can attach up to ${MAX_ATTACHMENTS} files.`, 'info');
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({ multiple: true, type: '*/*' });
    if (result.canceled) return;
    for (const asset of result.assets || []) {
      startUpload({
        key: nextAttachmentKey(),
        name: asset.name || `file-${Date.now()}`,
        uri: asset.uri,
        mimeType: asset.mimeType || 'application/octet-stream',
        status: 'uploading',
      });
    }
  };

  const handleRemoveAttachment = (key) => {
    setAttachments((prev) => prev.filter((a) => a.key !== key));
  };

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      showToast('Describe the bug or suggestion first.', 'info');
      return;
    }
    if (uploadingCount > 0) {
      showToast('Wait for your attachments to finish uploading first.', 'info');
      return;
    }
    setSubmitting(true);
    try {
      const attachmentUrls = attachments.filter((a) => a.status === 'done').map((a) => a.url);
      await api.submitFeedback({
        type,
        page,
        message: trimmed,
        stepsToReproduce: stepsToReproduce.trim() || null,
        attachmentUrls,
        appVersion: Constants.expoConfig?.version,
        platform: Platform.OS,
      });
      showToast('Thanks! Your feedback has been sent.', 'success');
      // The toast renders inside this screen — navigating away immediately
      // would unmount it before anyone could read it.
      setTimeout(() => navigation.goBack(), 900);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't send it — something went wrong.", 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StackHeader title="Report a Bug / Suggestion" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.typeRow}>
          {TYPES.map((option) => {
            const active = type === option.value;
            return (
              <Pressable
                key={option.value}
                style={[styles.typePill, active && styles.typePillActive]}
                onPress={() => setType(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.typePillText, active && styles.typePillTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Which page is this about?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pageScroll} contentContainerStyle={styles.pageRow}>
          {PAGES.map((option) => {
            const active = page === option;
            return (
              <Pressable
                key={option}
                style={[styles.pagePill, active && styles.pagePillActive]}
                onPress={() => setPage(active ? null : option)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.pagePillText, active && styles.pagePillTextActive]}>{option}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.label}>{type === 'BUG' ? 'What went wrong?' : 'What would you like to see?'}</Text>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={6}
          placeholder={type === 'BUG' ? 'Describe what happened and what you expected…' : 'Describe your idea…'}
          placeholderTextColor={colors.textMuted}
        />

        {type === 'BUG' ? (
          <>
            <Text style={styles.label}>Steps to reproduce (optional)</Text>
            <TextInput
              style={[styles.input, styles.stepsInput]}
              value={stepsToReproduce}
              onChangeText={setStepsToReproduce}
              multiline
              numberOfLines={4}
              placeholder={'1. Open the Habits tab\n2. Tap...\n3. See...'}
              placeholderTextColor={colors.textMuted}
            />
          </>
        ) : null}

        <Text style={styles.label}>Attachments (optional)</Text>
        {attachments.map((a) => (
          <View key={a.key} style={styles.attachmentRow}>
            <MaterialCommunityIcons
              name={a.mimeType?.startsWith('image/') ? 'image-outline' : 'file-outline'}
              size={18}
              color={colors.textSecondary}
            />
            <Text style={styles.attachmentName} numberOfLines={1}>
              {a.name}
            </Text>
            {a.status === 'uploading' ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : a.status === 'error' ? (
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.atRisk} />
            ) : (
              <MaterialCommunityIcons name="check-circle-outline" size={18} color={colors.safe} />
            )}
            <Pressable onPress={() => handleRemoveAttachment(a.key)} hitSlop={8}>
              <MaterialCommunityIcons name="close" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        ))}
        <View style={styles.attachmentButtonsRow}>
          <Pressable style={styles.secondaryButton} onPress={handleAddPhoto} disabled={!canAddMore}>
            <MaterialCommunityIcons name="image-plus" size={16} color={colors.textSecondary} />
            <Text style={styles.secondaryButtonText}>Add Photo</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={handleAddDocument} disabled={!canAddMore}>
            <MaterialCommunityIcons name="file-plus-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.secondaryButtonText}>Add Document</Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.primaryButton, (submitting || uploadingCount > 0) && styles.primaryButtonDisabled]}
          disabled={submitting || uploadingCount > 0}
          onPress={handleSubmit}
        >
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Send</Text>}
        </Pressable>
      </ScrollView>
      <Toast toast={toast} onHide={hideToast} />
    </SafeAreaView>
  );
}

function makeStyles(colors, typography) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    container: { padding: spacing.lg, paddingBottom: spacing.xxl },
    typeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    typePill: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.pill,
      paddingVertical: spacing.sm + 2,
      backgroundColor: colors.surface,
    },
    typePillActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
    typePillText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
    typePillTextActive: { color: colors.accent },
    label: { ...typography.label, marginBottom: spacing.sm },
    pageScroll: { marginBottom: spacing.lg },
    pageRow: { gap: spacing.sm, paddingRight: spacing.sm },
    pagePill: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.pill,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.surface,
    },
    pagePillActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
    pagePillText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    pagePillTextActive: { color: colors.accent },
    input: {
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: 15,
      color: colors.textPrimary,
      minHeight: 140,
      textAlignVertical: 'top',
      marginBottom: spacing.lg,
    },
    stepsInput: { minHeight: 90 },
    attachmentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      marginBottom: spacing.sm,
    },
    attachmentName: { flex: 1, fontSize: 13, color: colors.textPrimary },
    attachmentButtonsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    secondaryButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      paddingVertical: spacing.sm + 2,
      backgroundColor: colors.surface,
    },
    secondaryButtonText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    primaryButton: {
      backgroundColor: colors.accent,
      borderRadius: radii.pill,
      paddingVertical: spacing.md,
      alignItems: 'center',
      minHeight: 48,
      justifyContent: 'center',
    },
    primaryButtonDisabled: { opacity: 0.6 },
    primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  });
}
