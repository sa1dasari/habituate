import React, { useMemo } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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
 * Gated on `displayStep.scope` (not the live `currentStep.scope` — see the
 * in-function comment), so only the host matching the actually-displayed
 * step ever renders anything (the rest bail out with `return null` below)
 * — that's what lets `measureTourTarget` find real, already-laid-out
 * elements inside whichever host (a screen, or a host like CreateGroupModal,
 * AskHabituateModal, ProtectionInfoModal) is live.
 *
 * Renders its own `<Modal transparent>` rather than a plain absolutely
 * positioned View — Android draws plain View siblings by `elevation`, not
 * JSX order, so a `shadowLg`/`shadow` card elsewhere on the host screen
 * (elevation 6 or 2) would composite ON TOP of a plain overlay despite it
 * mounting later and being fully `active`, leaving the tour invisible. A
 * `<Modal>` always renders into its own Android Window above everything,
 * sidestepping that. `statusBarTranslucent` keeps its coordinate origin at
 * the true screen top, matching the window-relative rect
 * `useOnboardingTour` measures via `measureInWindow`.
 */
export default function TourHighlight({ scope }) {
  const { colors, typography, gradients } = useAppTheme();
  const { active, displayStep, displayTargetRect, displayStepIndex, totalSteps, next, back, skip } =
    useOnboardingTour();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);

  // Gated on displayStep, not the live currentStep — see useOnboardingTour's
  // comment on displayStep. currentStep can jump to a different scope the
  // instant next()/back() fires (that's what lets the destination screen's
  // real modal start opening immediately), but this host should keep
  // rendering its OWN still-consistent step right up until displayStep
  // itself swaps over, so the old spotlight never disappears before the new
  // one is ready to take its place.
  if (!active || !displayStep || displayStep.scope !== scope) return null;

  const { height: winH } = Dimensions.get('window');
  const rect = displayTargetRect
    ? {
        x: Math.max(0, displayTargetRect.x - PAD),
        y: Math.max(0, displayTargetRect.y - PAD),
        width: displayTargetRect.width + PAD * 2,
        height: displayTargetRect.height + PAD * 2,
      }
    : null;

  const spaceBelow = rect ? winH - (rect.y + rect.height) : 0;
  const calloutTop = rect
    ? spaceBelow > CALLOUT_HEIGHT_ESTIMATE + spacing.xl
      ? rect.y + rect.height + spacing.lg
      : Math.max(spacing.xxl, rect.y - CALLOUT_HEIGHT_ESTIMATE)
    : null;

  const isFirst = displayStepIndex === 0;
  const isLast = displayStepIndex === totalSteps - 1;

  // A plain absolutely-positioned View here was invisible on Android: bare
  // View siblings draw by elevation, not JSX order, so a `shadowLg`/`shadow`
  // card elsewhere on the same screen (elevation 6 or 2) composited ON TOP
  // of this overlay despite it mounting later and being fully `active`.
  // A native <Modal> sidesteps that entirely by rendering into its own
  // Android Window, above the whole app, the same guarantee the modal-scoped
  // tour steps already rely on (see the class doc above). statusBarTranslucent
  // keeps the Modal's coordinate origin at the true screen top, matching the
  // window-relative rect useOnboardingTour measures via measureInWindow.
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={skip}>
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
          {/* The cutout itself has no view over it otherwise — nothing in the
              Modal's own content occupies that gap — so a tap there fell
              straight through to whatever real element the spotlight is
              highlighting underneath (e.g. actually opening the create-habit
              form a step early). This intercepts it and treats a tap on the
              highlighted element exactly like "Next", same as the button. */}
          <Pressable
            onPress={next}
            hitSlop={8}
            style={{ position: 'absolute', top: rect.y, left: rect.x, width: rect.width, height: rect.height }}
            accessibilityRole="button"
            accessibilityLabel={isLast ? 'Finish tour' : 'Next'}
          />
        </>
      ) : (
        <View style={[styles.backdrop, StyleSheet.absoluteFillObject]} />
      )}

      <View style={[styles.calloutWrap, calloutTop != null ? { top: calloutTop } : styles.calloutCentered]}>
        <View style={styles.calloutCard}>
          <LinearGradient colors={gradients.accent} style={styles.accentBar} />
          <View style={styles.calloutBody}>
            <View style={styles.headerRow}>
              <Text style={styles.eyebrow}>{displayStep.eyebrow}</Text>
              <Pressable
                onPress={skip}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Skip tour"
              >
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
            </View>

            <Text style={styles.title}>{displayStep.title}</Text>
            <Text style={styles.body}>{displayStep.body}</Text>

            {displayStep.fastPathLabel ? (
              <Pressable
                onPress={skip}
                style={styles.fastPathBtn}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={displayStep.fastPathLabel}
              >
                <Text style={styles.fastPathText}>{displayStep.fastPathLabel}</Text>
              </Pressable>
            ) : null}

            <View style={styles.footerRow}>
              <View style={styles.dotsRow}>
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <View key={i} style={[styles.dot, i === displayStepIndex && styles.dotActive]} />
                ))}
              </View>

              <View style={styles.buttonsRow}>
                {!isFirst ? (
                  <Pressable onPress={back} style={styles.backBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
                    <Text style={styles.backBtnText}>Back</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={next}
                  hitSlop={8}
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
    </Modal>
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
    fastPathBtn: {
      marginTop: spacing.md,
      alignSelf: 'flex-start',
      minHeight: 44,
      justifyContent: 'center',
    },
    fastPathText: {
      fontFamily: fonts.semiBold,
      fontSize: 13,
      color: colors.accent,
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
