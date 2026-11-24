import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import ShareCard from './ShareCard';
import Toast from './Toast';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import api from '../api/client';
import { fonts, radii, shadowLg, spacing } from '../theme';

/**
 * Board 86. Part 1 scope (SKYLINE.md Phase 8a): a single tower only — the
 * "My whole skyline" radio is a separate, not-yet-built mode (Part 2), so
 * this sheet only ever renders when opened with a `habit`. Format defaults
 * to Square; Story is fully built too (same ShareCard, taller layout);
 * Clip is shown per the approved board but not wired yet — tapping it
 * surfaces that plainly rather than silently doing nothing.
 */
export default function ShareSheet({ visible, onClose, habit }) {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [format, setFormat] = useState('square');
  const [showUsername, setShowUsername] = useState(true);
  const [username, setUsername] = useState(null);
  const shareCardRef = React.useRef(null);

  useEffect(() => {
    if (!visible) return undefined;
    let cancelled = false;
    api
      .getUserProfile()
      .then((profile) => {
        if (!cancelled) setUsername(profile?.username || null);
      })
      .catch(() => {
        // Username is a nice-to-have on the card (board 86's toggle), not
        // required to share — a failed fetch just means the switch has
        // nothing to show, handled below by hiding it rather than erroring.
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const handleShare = async () => {
    try {
      const base64 = await shareCardRef.current?.capture?.();
      if (!base64) {
        showToast("Couldn't build the share image — try again.", 'error');
        return;
      }
      await Share.share(
        { url: `data:image/png;base64,${base64}` },
        { dialogTitle: 'Share your tower' }
      );
    } catch (err) {
      if (err?.message !== 'User did not share') {
        showToast(err instanceof Error ? err.message : "Couldn't share — try again.", 'error');
      }
    }
  };

  if (!habit) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <View style={styles.handle} />
        <Text style={styles.title}>Share</Text>
        <Text style={styles.subtitle}>Choose what to share and how.</Text>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{habit.name}</Text>
            <Text style={styles.rowSubtitle} numberOfLines={1}>
              {habit.streak ?? habit.currentRun ?? 0} day run
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>FORMAT</Text>
        <View style={styles.formatRow}>
          {[
            { key: 'square', label: 'Square' },
            { key: 'story', label: 'Story' },
            { key: 'clip', label: 'Clip' },
          ].map((f) => (
            <Pressable
              key={f.key}
              onPress={() => {
                if (f.key === 'clip') {
                  showToast('Clips are coming soon.');
                  return;
                }
                setFormat(f.key);
              }}
              style={[styles.formatPill, format === f.key ? styles.formatPillActive : null]}
              accessibilityRole="button"
              accessibilityLabel={f.label}
              accessibilityState={{ selected: format === f.key }}
            >
              <Text style={[styles.formatPillText, format === f.key ? styles.formatPillTextActive : null]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {username ? (
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Show @{username}</Text>
              <Text style={styles.rowSubtitle}>Adds your username to the card.</Text>
            </View>
            <Pressable
              onPress={() => setShowUsername((v) => !v)}
              accessibilityRole="switch"
              accessibilityState={{ checked: showUsername }}
              accessibilityLabel={`Show @${username} on the card`}
              style={[styles.toggle, showUsername ? styles.toggleOn : null]}
            >
              <View style={[styles.toggleThumb, showUsername ? styles.toggleThumbOn : null]} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.previewWrap}>
          <ViewShot
            ref={shareCardRef}
            options={{
              format: 'png',
              result: 'base64',
              width: 1080,
              height: format === 'story' ? 1920 : 1080,
            }}
          >
            <ShareCard habit={habit} format={format === 'story' ? 'story' : 'square'} showUsername={showUsername} username={username} />
          </ViewShot>
        </View>

        <Pressable onPress={handleShare} style={styles.shareBtn} accessibilityRole="button" accessibilityLabel="Share">
          <Text style={styles.shareBtnText}>Share</Text>
        </Pressable>
        <Pressable
          onPress={() => showToast('Saving to photos is coming soon.')}
          style={styles.saveLink}
          accessibilityRole="button"
          accessibilityLabel="Save to photos"
        >
          <Text style={styles.saveLinkText}>Save to photos</Text>
        </Pressable>

        <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close">
          <MaterialCommunityIcons name="close" size={20} color={colors.textMuted} />
        </Pressable>
      </SafeAreaView>
      <Toast toast={toast} onHide={hideToast} />
    </Modal>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(8,10,16,0.6)' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii.lg,
      borderTopRightRadius: radii.lg,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.lg,
      ...shadowLg,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: spacing.md,
    },
    title: { fontFamily: fonts.extraBold, fontSize: 24, color: colors.textPrimary },
    subtitle: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowText: { flex: 1, paddingRight: spacing.md },
    rowTitle: { fontFamily: fonts.extraBold, fontSize: 16, color: colors.textPrimary },
    rowSubtitle: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginTop: 2 },
    sectionLabel: {
      fontFamily: fonts.extraBold,
      fontSize: 11,
      letterSpacing: 1,
      color: colors.textMuted,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    formatRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
    formatPill: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      alignItems: 'center',
      backgroundColor: colors.border,
    },
    formatPillActive: { borderWidth: 2, borderColor: colors.accent, backgroundColor: 'transparent' },
    formatPillText: { fontFamily: fonts.extraBold, fontSize: 15, color: colors.textPrimary },
    formatPillTextActive: { color: colors.accent },
    toggle: {
      width: 48,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.border,
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    toggleOn: { backgroundColor: colors.accent },
    toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.background },
    toggleThumbOn: { alignSelf: 'flex-end' },
    previewWrap: { alignItems: 'center', marginVertical: spacing.md },
    shareBtn: {
      backgroundColor: colors.accent,
      borderRadius: radii.pill,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    shareBtnText: { fontFamily: fonts.extraBold, fontSize: 16, color: '#1A1300' },
    saveLink: { alignItems: 'center', paddingVertical: spacing.sm },
    saveLinkText: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.textMuted },
    closeBtn: { position: 'absolute', top: spacing.sm, right: spacing.lg },
  });
}
