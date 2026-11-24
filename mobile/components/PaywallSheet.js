import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Purchases from 'react-native-purchases';
import Toast from './Toast';
import { useAppTheme } from '../hooks/useAppTheme';
import { useToast } from '../hooks/useToast';
import { PRO_ENTITLEMENT_ID } from '../hooks/useEntitlement';
import { paywallCopy } from '../utils/entitlements';
import { fonts, radii, shadowLg, spacing } from '../theme';

const BENEFITS = [
  'Unlimited daily, weekly and monthly habits',
  'Unlimited Shield Days',
  'Cancel monthly any time',
];

/** RevenueCat's own packageType enum values for these two product shapes —
 * matches whichever products get attached to the dashboard's current
 * offering, not an app-side product id this backend would otherwise need to
 * hardcode. */
const LIFETIME_PACKAGE_TYPE = 'LIFETIME';
const MONTHLY_PACKAGE_TYPE = 'MONTHLY';

/**
 * Board 87/88: shown over the still-filled-out create form when Save hits a
 * free-tier cap. Never says "can't", "limit reached" or "locked" (board 88's
 * own rule) and never names Ask Habituate — copy stays in utils/entitlements.js
 * so it's identical wherever this sheet is opened from. `cap` selects which
 * of the per-cap body-copy variants shows (board 88); the headline/benefits
 * are always the same. Two plan cards (owner added monthly alongside
 * lifetime, 2026-11-24, board 87 v2) — Lifetime is the default selection and
 * always carries the "Best value" tag regardless of which is selected; the
 * CTA label and the actual purchase both follow whichever plan is selected.
 * `onUnlocked` fires after a successful purchase or restore so the caller
 * can retry the action that was blocked.
 */
export default function PaywallSheet({ visible, onClose, cap, counts, onUnlocked }) {
  const { colors } = useAppTheme();
  const { toast, showToast, hideToast } = useToast();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [lifetimePkg, setLifetimePkg] = useState(null);
  const [monthlyPkg, setMonthlyPkg] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState('lifetime');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return undefined;
    setSelectedPlan('lifetime');
    let cancelled = false;
    Purchases.getOfferings()
      .then((offerings) => {
        if (cancelled) return;
        const pkgs = offerings?.current?.availablePackages || [];
        setLifetimePkg(pkgs.find((p) => p.packageType === LIFETIME_PACKAGE_TYPE) || null);
        setMonthlyPkg(pkgs.find((p) => p.packageType === MONTHLY_PACKAGE_TYPE) || null);
      })
      .catch(() => {
        // No RevenueCat project configured this build — prices fall back to
        // generic labels below rather than showing a design placeholder.
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  if (!cap) return null;
  const copy = paywallCopy(cap, counts || {});

  const lifetimePrice = lifetimePkg?.product?.priceString || null;
  const monthlyPrice = monthlyPkg?.product?.priceString || null;
  const selectedPkg = selectedPlan === 'monthly' ? monthlyPkg : lifetimePkg;
  const ctaLabel =
    selectedPlan === 'monthly'
      ? monthlyPrice
        ? `Start monthly for ${monthlyPrice}`
        : 'Start monthly plan'
      : lifetimePrice
        ? `Unlock lifetime for ${lifetimePrice}`
        : 'Unlock lifetime access';

  const handleUnlock = async () => {
    setBusy(true);
    try {
      if (!selectedPkg) {
        showToast("That plan isn't available right now — try again later.", 'error');
        return;
      }
      const { customerInfo } = await Purchases.purchasePackage(selectedPkg);
      if (customerInfo?.entitlements?.active?.[PRO_ENTITLEMENT_ID]) {
        showToast(selectedPlan === 'monthly' ? 'You’re in! Your skyline has no more limits.' : 'Unlocked! Your skyline has no more limits.');
        onUnlocked?.();
      }
    } catch (err) {
      if (!err?.userCancelled) {
        showToast(err instanceof Error ? err.message : "Couldn't complete the purchase — try again.", 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    setBusy(true);
    try {
      const info = await Purchases.restorePurchases();
      if (info?.entitlements?.active?.[PRO_ENTITLEMENT_ID]) {
        showToast('Purchase restored!');
        onUnlocked?.();
      } else {
        showToast('No previous purchase found.');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't restore purchases — try again.", 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="paywall-backdrop" />
      <SafeAreaView style={styles.sheet} edges={['bottom']} testID="paywall-sheet">
        <View style={styles.handle} />
        <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
        <Text style={styles.headline}>Room for more towers</Text>
        <Text style={styles.body}>{copy.body}</Text>

        <View style={styles.benefits}>
          {BENEFITS.map((b) => (
            <View key={b} style={styles.benefitRow}>
              <MaterialCommunityIcons name="check" size={18} color={colors.accent} />
              <Text style={styles.benefitText}>{b}</Text>
            </View>
          ))}
        </View>

        <Pressable
          onPress={() => setSelectedPlan('lifetime')}
          style={[styles.planCard, styles.planCardLifetime, selectedPlan === 'lifetime' ? styles.planCardSelected : null]}
          accessibilityRole="radio"
          accessibilityState={{ checked: selectedPlan === 'lifetime' }}
          accessibilityLabel={`Lifetime, ${lifetimePrice || 'price unavailable'}, best value`}
          testID="paywall-plan-lifetime"
        >
          <View style={[styles.planRadio, selectedPlan === 'lifetime' ? styles.planRadioSelected : null]} />
          <View style={styles.planText}>
            <View style={styles.planTitleRow}>
              <Text style={styles.planTitle}>Lifetime</Text>
              <View style={styles.bestValueTag}>
                <Text style={styles.bestValueTagText}>Best value</Text>
              </View>
            </View>
            <Text style={styles.planSubtitle}>Pay once, keep it for good</Text>
          </View>
          {lifetimePrice ? <Text style={styles.planPrice}>{lifetimePrice}</Text> : null}
        </Pressable>

        <Pressable
          onPress={() => setSelectedPlan('monthly')}
          style={[styles.planCard, selectedPlan === 'monthly' ? styles.planCardSelected : null]}
          accessibilityRole="radio"
          accessibilityState={{ checked: selectedPlan === 'monthly' }}
          accessibilityLabel={`Monthly, ${monthlyPrice || 'price unavailable'} per month`}
          testID="paywall-plan-monthly"
        >
          <View style={[styles.planRadio, selectedPlan === 'monthly' ? styles.planRadioSelected : null]} />
          <View style={styles.planText}>
            <Text style={styles.planTitle}>Monthly</Text>
            <Text style={styles.planSubtitle}>Cancel any time</Text>
          </View>
          {monthlyPrice ? (
            <View style={styles.planPriceRow}>
              <Text style={styles.planPrice}>{monthlyPrice}</Text>
              <Text style={styles.planPriceSuffix}> / month</Text>
            </View>
          ) : null}
        </Pressable>

        <Pressable
          onPress={handleUnlock}
          disabled={busy}
          style={[styles.unlockBtn, busy ? styles.unlockBtnBusy : null]}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          testID="paywall-unlock"
        >
          <Text style={styles.unlockBtnText}>{ctaLabel}</Text>
        </Pressable>

        <Pressable onPress={onClose} style={styles.notNow} accessibilityRole="button" accessibilityLabel="Not now" testID="paywall-not-now">
          <Text style={styles.notNowText}>Not now</Text>
        </Pressable>

        <Text style={styles.footerNote}>Your form is saved. Your towers stay exactly as they are.</Text>
        <Pressable onPress={handleRestore} disabled={busy} accessibilityRole="button" accessibilityLabel="Restore purchase" testID="paywall-restore">
          <Text style={styles.restoreText}>Restore purchase</Text>
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
      paddingTop: spacing.xs,
      paddingBottom: spacing.lg,
      ...shadowLg,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: spacing.sm,
    },
    eyebrow: { fontFamily: fonts.extraBold, fontSize: 12, letterSpacing: 1, color: colors.accent },
    headline: { fontFamily: fonts.extraBold, fontSize: 26, color: colors.textPrimary, marginTop: 4 },
    body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.textMuted, marginTop: spacing.sm },
    benefits: { marginTop: spacing.lg, gap: spacing.sm },
    benefitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    benefitText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.textPrimary, flex: 1 },
    planCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 64,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginTop: spacing.md,
    },
    planCardLifetime: {},
    planCardSelected: { borderWidth: 2, borderColor: colors.accent, backgroundColor: 'rgba(242, 193, 78, 0.08)' },
    planRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border },
    planRadioSelected: { borderWidth: 6, borderColor: colors.accent },
    planText: { flex: 1 },
    planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    planTitle: { fontFamily: fonts.extraBold, fontSize: 16, color: colors.textPrimary },
    planSubtitle: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 1 },
    bestValueTag: { backgroundColor: colors.accent, borderRadius: radii.pill, paddingHorizontal: spacing.xs, paddingVertical: 2 },
    bestValueTagText: { fontFamily: fonts.extraBold, fontSize: 10, color: '#1A1300' },
    planPrice: { fontFamily: fonts.extraBold, fontSize: 17, color: colors.textPrimary },
    planPriceRow: { flexDirection: 'row', alignItems: 'baseline' },
    planPriceSuffix: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
    unlockBtn: {
      backgroundColor: colors.accent,
      borderRadius: radii.pill,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginTop: spacing.lg,
      minHeight: 54,
      justifyContent: 'center',
    },
    unlockBtnBusy: { opacity: 0.6 },
    unlockBtnText: { fontFamily: fonts.extraBold, fontSize: 16, color: '#1A1300' },
    notNow: { alignItems: 'center', paddingVertical: spacing.md },
    notNowText: { fontFamily: fonts.extraBold, fontSize: 16, color: colors.textPrimary },
    footerNote: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
    restoreText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs, paddingVertical: spacing.xs },
  });
}
