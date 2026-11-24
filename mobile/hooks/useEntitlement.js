import { useEffect, useState } from 'react';
import Purchases from 'react-native-purchases';

/** Must match EntitlementService.PRO_ENTITLEMENT_ID on the backend and
 * the entitlement identifier configured in the RevenueCat dashboard. */
export const PRO_ENTITLEMENT_ID = 'pro';

/**
 * Reads the client's own copy of entitlement state from the RevenueCat SDK
 * — the paywall UI's "is this user already pro" check. Defensive by design:
 * without a real RevenueCat project configured (no EXPO_PUBLIC_REVENUECAT_*
 * key this build — SKYLINE.md Phase 8a), Purchases.configure() was never
 * called, so getCustomerInfo() is expected to throw; that's treated as
 * "free tier," never as "entitled," since a safe default here means a free
 * user at worst sees a paywall they shouldn't, not a free ride.
 */
export function useEntitlement() {
  const [isPro, setIsPro] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const applyCustomerInfo = (info) => {
      if (!mounted) return;
      setIsPro(Boolean(info?.entitlements?.active?.[PRO_ENTITLEMENT_ID]));
      setReady(true);
    };

    Purchases.getCustomerInfo()
      .then(applyCustomerInfo)
      .catch(() => {
        if (mounted) setReady(true);
      });

    const listener = (info) => applyCustomerInfo(info);
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      mounted = false;
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, []);

  return { isPro, ready };
}
