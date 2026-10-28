import React, { useMemo } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../hooks/useAppTheme';
import { useOnboardingTour } from '../hooks/useOnboardingTour';
import { fonts, radii, shadowLg, spacing } from '../theme';

const PAD = 10;
const CALLOUT_HEIGHT_ESTIMATE = 230;

/**
 * The tour's spotlight + callout, mounted once inside EVERY screen/modal
 * that can host a step (one per TOUR_SCOPES value) — never once globally.
 * A native RN <Modal> (CreateGroupModal, AskHabituateModal, ProtectionInfoModal,
 * ...) renders in its own OS-level layer above the rest of the app, so an
 * overlay declared outside it could never draw on top of it; mounting this
 * locally inside each host, gated on `currentStep.scope`, sidesteps that
 * entirely — only the host matching the live step ever renders anything.
 *
 * Render this as a SIBLING of the host's top-level SafeAreaView (not a
 * child of it) so its coordinates line up with the window-relative rect
 * useOnboardingTour measures via measureInWindow — a SafeAreaView's own top
 * inset would otherwise double-offset everything.
 */
export default function TourHighlight({ scope }) {
  const { colors, typography, gradients } = useAppTheme();
  const { active, currentStep, targetRect, stepIndex, totalSteps, next, back, skip } =
    useOnboardingTour();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);

  if (!active || !currentStep || currentStep.scope !== scope) return null;

  const { height: winH } = Dimensions.get('window');
  const rect = targetRect
    ? {
        x: Math.max(0, targetRect.x - PAD),
        y: Math.max(0, targetRect.y - PAD),
        width: targetRect.width + PAD * 2,
        height: targetRect.height + PAD * 2,
      }
    : null;

  const spaceBelow = rect ? winH - (rect.y + rect.height) : 0;
  const calloutTop = rect
    ? spaceBelow > CALLOUT_HEIGHT_ESTIMATE + spacing.xl
      ? rect.y + rect.height + spacing.lg
      : Math.max(spacing.xxl, rect.y - CALLOUT_HEIGHT_ESTIMATE)
    : null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {rect ? (
        <>
          <View style={[styles.backdrop, { top: 0, left: 0, right: 0, height: rect.y }]} />
          <View
            style={[styles.backdrop, { top: rect.y + rect.height, left: 0, right: 0, bottom: 0 }]}
          />
          <View style={[styles.backdrop, { top: rect.y, height: rect.height, left: 0, width: rect.x }]} />
          <View
            style={[
              styles.backdrop,
              { top: rect.y, height: rect.height, left: rect.x + rect.width, right: 0 },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.spotlightRing,
              { top: rect.y, left: rect.x, width: rect.width, height: rect.height },
            ]}
          />
        </>
      ) : (
        <View style={styles.backdrop} />
      )}

      <View style={[styles.calloutWrap, calloutTop != null ? { top: calloutTop } : styles.calloutCentered]}>
        <View style={styles.calloutCard}>
          <LinearGradient colors={gradients.accent} style={styles.accentBar} />
          <View style={styles.calloutBody}>
            <View style={styles.headerRow}>
              <Text style={styles.eyebrow}>{currentStep.eyebrow}</Text>
              <Pressable
                onPress={skip}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Skip tour"
              >
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
            </View>

            <Text style={styles.title}>{currentStep.title}</Text>
            <Text style={styles.body}>{currentStep.body}</Text>

            <View style={styles.footerRow}>
              <View style={styles.dotsRow}>
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <View key={i} style={[styles.dot, i === stepIndex && styles.dotActive]} />
                ))}
              </View>

              <View style={styles.buttonsRow}>
                {!isFirst ? (
                  <Pressable onPress={back} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
                    <Text style={styles.backBtnText}>Back</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={next}
                  accessibilityRole="button"
                  accessibilityLabel={isLast ? 'Finish tour' : 'Next'}
                >
                  <LinearGradient colors={gradients.accent} style={styles.nextBtn}>
                    <Text style={styles.nextBtnText}>{isLast ? "Let's go" : 'Next'}</Text>
                    <MaterialCommunityIcons
                      name={isLast ? 'rocket-launch-outline' : 'arrow-right'}
                      size={15}
                      color="#FFFFFF"
                    />
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function makeStyles(colors, typography) {
  return StyleSheet.create({
    backdrop: {
      position: 'absolute',
      backgroundColor: 'rgba(8, 10, 16, 0.68)',
    },
    spotlightRing: {
      position: 'absolute',
      borderRadius: radii.lg,
      borderWidth: 3,
      borderColor: colors.accent,
    },
    calloutWrap: {
      position: 'absolute',
      left: spacing.lg,
      right: spacing.lg,
    },
    calloutCentered: {
      top: '38%',
    },
    calloutCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      overflow: 'hidden',
      ...shadowLg,
    },
    accentBar: { height: 5, width: '100%' },
    calloutBody: { padding: spacing.lg },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    eyebrow: {
      fontFamily: fonts.extraBold,
      fontSize: 11,
      letterSpacing: 0.8,
      color: colors.accent,
    },
    skipText: {
      fontFamily: fonts.semiBold,
      fontSize: 13,
      color: colors.textMuted,
    },
    title: {
      ...typography.sectionTitle,
      fontSize: 19,
      marginBottom: spacing.xs,
    },
    body: {
      ...typography.body,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.lg,
    },
    dotsRow: { flexDirection: 'row', gap: 6 },
    dot: {
      width: 6,
      height: 6,
      borderRadius: radii.pill,
      backgroundColor: colors.border,
    },
    dotActive: {
      backgroundColor: colors.accent,
      width: 16,
    },
    buttonsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    backBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
    backBtnText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
    nextBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm + 2,
    },
    nextBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  });
}
