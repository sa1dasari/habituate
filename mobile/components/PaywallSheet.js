import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Purchases from 'react-native-purchases';
import Toast from './Toast';
import { useAppTheme } from '../hooks/useAppTheme';
import { useToast } from '../hooks/useToast';
import { LIFETIME_ENTITLEMENT_ID } from '../hooks/useEntitlement';
import { paywallCopy } from '../utils/entitlements';
import { fonts, radii, shadowLg, spacing } from '../theme';

const BENEFITS = [
  'Unlimited daily, weekly and monthly habits',
  'Unlimited Shield Days',
  'Pay once. No subscription.',
];

/**
 * Board 87/88: shown over the still-filled-out create form when Save hits a
 * free-tier cap. Never says "can't", "limit reached" or "locked" (board 88's
 * own rule) and never names Ask Habituate — copy stays in utils/entitlements.js
 * so it's identical wherever this sheet is opened from. `cap` selects which
 * of the three body-copy variants shows (board 88); the headline/benefits/CTA
 * are always the same. `onUnlocked` fires after a successful purchase or
 * restore so the caller can retry the action that was blocked.
 */
export default function PaywallSheet({ visible, onClose, cap, counts, onUnlocked }) {
  const { colors } = useAppTheme();
  const { toast, showToast, hideToast } = useToast();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [priceString, setPriceString] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return undefined;
    let cancelled = false;
    Purchases.getOfferings()
      .then((offerings) => {
        const pkg = offerings?.current?.availablePackages?.[0];
        if (!cancelled && pkg?.product?.priceString) setPriceString(pkg.product.priceString);
      })
      .catch(() => {
        // No RevenueCat project configured this build — the CTA falls back
        // to a generic label below rather than showing a design placeholder.
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  if (!cap) return null;
  const copy = paywallCopy(cap, counts || {});

  const handleUnlock = async () => {
    setBusy(true);
    try {
      const offerings = await Purchases.getOfferings();
      const pkg = offerings?.current?.availablePackages?.[0];
      if (!pkg) {
        showToast("Unlock isn't available right now — try again later.", 'error');
        return;
      }
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      if (customerInfo?.entitlements?.active?.[LIFETIME_ENTITLEMENT_ID]) {
        showToast('Unlocked! Your skyline has no more limits.');
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
      if (info?.entitlements?.active?.[LIFETIME_ENTITLEMENT_ID]) {
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
          onPress={handleUnlock}
          disabled={busy}
          style={[styles.unlockBtn, busy ? styles.unlockBtnBusy : null]}
          accessibilityRole="button"
          accessibilityLabel={priceString ? `Unlock for ${priceString}` : 'Unlock lifetime access'}
          testID="paywall-unlock"
        >
          <Text style={styles.unlockBtnText}>{priceString ? `Unlock for ${priceString}` : 'Unlock lifetime access'}</Text>
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
    eyebrow: { fontFamily: fonts.extraBold, fontSize: 12, letterSpacing: 1, color: colors.accent },
    headline: { fontFamily: fonts.extraBold, fontSize: 26, color: colors.textPrimary, marginTop: 4 },
    body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.textMuted, marginTop: spacing.sm },
    benefits: { marginTop: spacing.lg, gap: spacing.sm },
    benefitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    benefitText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.textPrimary, flex: 1 },
    unlockBtn: {
      backgroundColor: colors.accent,
      borderRadius: radii.pill,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginTop: spacing.lg,
    },
    unlockBtnBusy: { opacity: 0.6 },
    unlockBtnText: { fontFamily: fonts.extraBold, fontSize: 16, color: '#1A1300' },
    notNow: { alignItems: 'center', paddingVertical: spacing.md },
    notNowText: { fontFamily: fonts.extraBold, fontSize: 16, color: colors.textPrimary },
    footerNote: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
    restoreText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs, paddingVertical: spacing.xs },
  });
}
