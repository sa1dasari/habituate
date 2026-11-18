import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../hooks/useAppTheme';
import { useOnboardingTour } from '../hooks/useOnboardingTour';
import { fonts, radii, shadowLg, skylineUI, spacing } from '../theme';

const PAD = 10;
const CARD_HEIGHT_ESTIMATE = 200;

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
  const { typography, effectiveMode } = useAppTheme();
  // Skyline look (boards 46-50): amber accents and a dark-on-amber Next button.
  const colors = useMemo(() => {
    const ui = skylineUI[effectiveMode];
    return { accent: ui.amber, surface: ui.surfaceHigh, textMuted: ui.muted, textSecondary: ui.muted, border: 'rgba(128,140,155,0.45)', text: ui.text };
  }, [effectiveMode]);
  const insets = useSafeAreaInsets();
  const { active, displayStep, displayTargetRect, displayStepIndex, totalSteps, next, skip } =
    useOnboardingTour();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);

  const isLive = active && !!displayStep && displayStep.scope === scope;

  // For a step whose host is itself a real native <Modal> (ProtectionInfoModal,
  // CreateGroupModal, CreateChallengeModal, AskHabituateModal) opening in the
  // SAME transition as the tour advancing, two native Dialog windows race to
  // open in the same frame — React's state is correct (confirmed via a live
  // logcat capture: this component is told to render with a matching scope),
  // but Android can finish adding the HOST's window on top of this one,
  // leaving the tour's own Modal fully invisible despite rendering correctly
  // underneath. A screen host (not a Modal) never hit this — the only real
  // Modal in that race was this component's own. Deferring this Modal's own
  // `visible` by one tick lets the host's window land first, so this one is
  // guaranteed to be the most-recently-added (topmost) window when it opens.
  const [modalVisible, setModalVisible] = useState(false);
  const [cardHeight, setCardHeight] = useState(CARD_HEIGHT_ESTIMATE);
  useEffect(() => {
    if (!isLive) {
      setModalVisible(false);
      return undefined;
    }
    const timer = setTimeout(() => setModalVisible(true), 0);
    return () => clearTimeout(timer);
  }, [isLive]);

  // Gated on displayStep, not the live currentStep — see useOnboardingTour's
  // comment on displayStep. currentStep can jump to a different scope the
  // instant next()/back() fires (that's what lets the destination screen's
  // real modal start opening immediately), but this host should keep
  // rendering its OWN still-consistent step right up until displayStep
  // itself swaps over, so the old spotlight never disappears before the new
  // one is ready to take its place.
  if (!isLive || !modalVisible) return null;

  const { height: winH, width: winW } = Dimensions.get('window');
  // A target that sits close to the top of its screen (a header icon row,
  // say) can have less than PAD of real gap above it — padding out by PAD
  // unconditionally then pushed the ring/cutout's top edge above the status
  // bar, into the OS chrome itself. Clamp the top edge to the safe-area
  // inset instead, trimming the padded height by the same amount so the
  // BOTTOM edge (the one that actually has room) stays exactly where PAD
  // would have put it.
  const rect = displayTargetRect
    ? (() => {
        const rawTop = displayTargetRect.y - PAD;
        const rawBottom = displayTargetRect.y + displayTargetRect.height + PAD;
        const top = Math.max(insets.top, rawTop);
        const x = Math.max(0, displayTargetRect.x - PAD);
        return {
          x,
          y: top,
          // Clamped to the window: the last tab button's padded rect would
          // otherwise run past the right edge.
          width: Math.min(winW - x, displayTargetRect.width + PAD * 2),
          height: Math.min(winH - top, Math.max(0, rawBottom - top)),
        };
      })()
    : null;

  // Card goes below the spotlight when it fits, else above (anchored by its
  // bottom edge so the measured card height never matters), else centered.
  const spaceBelow = rect ? winH - (rect.y + rect.height) : 0;
  const spaceAbove = rect ? rect.y : 0;
  let calloutPos = null;
  if (rect) {
    if (spaceBelow >= cardHeight + spacing.lg * 2) {
      calloutPos = { top: rect.y + rect.height + spacing.lg };
    } else if (spaceAbove >= cardHeight + spacing.lg * 2) {
      calloutPos = { bottom: winH - rect.y + spacing.lg };
    }
  }

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
            accessible={false}
          />
        </>
      ) : (
        <View style={[styles.backdrop, StyleSheet.absoluteFillObject]} />
      )}

      <View style={[styles.calloutWrap, calloutPos || styles.calloutCentered]}>
        <View
          style={styles.calloutCard}
          testID="tour-card"
          onLayout={(e) => setCardHeight(e.nativeEvent.layout.height)}
        >
          <View style={styles.calloutBody}>
            <Text style={styles.eyebrow}>{displayStep.eyebrow}</Text>
            <Text style={styles.title} accessibilityRole="header">{displayStep.title}</Text>
            <Text style={styles.body}>{displayStep.body}</Text>

            <View style={styles.footerRow}>
              {/* Fixed-width slot so the dots stay put on the last step,
                  where Skip is hidden. */}
              <View style={styles.skipSlot}>
                {!isLast ? (
                  <Pressable
                    onPress={skip}
                    hitSlop={10}
                    style={styles.skipBtn}
                    testID="tour-skip"
                    accessibilityRole="button"
                    accessibilityLabel="Skip tour"
                  >
                    <Text style={styles.skipText}>Skip</Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.dotsRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <View key={i} style={[styles.dot, i === displayStepIndex && styles.dotActive]} />
                ))}
              </View>

              <Pressable
                onPress={next}
                hitSlop={8}
                testID="tour-next"
                accessibilityRole="button"
                accessibilityLabel={isLast ? 'Done' : 'Next'}
              >
                <View style={[styles.nextBtn, { backgroundColor: colors.accent }]}>
                  <Text style={styles.nextBtnText}>{isLast ? 'Done' : 'Next'}</Text>
                </View>
              </Pressable>
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
    calloutBody: { padding: spacing.lg },
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
    skipSlot: { width: 64 },
    skipBtn: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
    title: {
      ...typography.sectionTitle,
      color: colors.text,
      fontSize: 19,
      marginTop: spacing.sm,
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
    nextBtn: {
      alignItems: 'center',
      borderRadius: radii.pill,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.sm + 2,
    },
    nextBtnText: { fontFamily: fonts.extraBold, fontSize: 14, color: '#1A1300' },
  });
}
