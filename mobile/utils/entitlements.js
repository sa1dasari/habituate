import { hasDailyTarget, effectiveWeeklyTarget, effectiveMonthlyTarget } from './cadence';

/** Free-tier caps (owner-confirmed, SKYLINE.md section 14 #21). Mirrors
 * api/billing/EntitlementService.java's constants exactly — keep both in
 * sync if these ever change. The Shield Day cap isn't here: it's enforced
 * entirely server-side by capping the existing banked-shields count
 * (ShieldAwardService), not a client-visible counter. */
export const FREE_TIER_LIMITS = { daily: 5, weekly: 1, monthly: 1 };

/** Display-only — the actual cap is enforced server-side (ShieldAwardService
 * caps the existing banked-shields count at this same number for a
 * non-entitled user, owner decision 2026-11-24). Mirrors
 * EntitlementService.FREE_SHIELD_BANK_LIMIT. */
export const FREE_SHIELD_BANK_LIMIT = 2;

/** Same classification TowerForm's own cadence picker already makes explicit
 * — pass the picker's 'DAILY'/'WEEKLY'/'MONTHLY' value directly for a form
 * still being filled out. For an already-saved habit, derive it the same
 * way SkylineScreen splits towers from lots (monthly takes priority over
 * weekly when a legacy habit somehow has both, matching utils/cadence.js's
 * own cadenceProgress priority). */
export function habitCapKey(habit) {
  if (!hasDailyTarget(habit)) {
    if (effectiveMonthlyTarget(habit) > 0) return 'monthly';
    if (effectiveWeeklyTarget(habit) > 0) return 'weekly';
  }
  return 'daily';
}

export function countByCap(habits) {
  const counts = { daily: 0, weekly: 0, monthly: 0 };
  (habits || []).forEach((h) => {
    counts[habitCapKey(h)] += 1;
  });
  return counts;
}

export function isAtCap(cap, counts, isPro) {
  if (isPro) return false;
  return (counts[cap] || 0) >= FREE_TIER_LIMITS[cap];
}

/** Board 88: same headline/benefits/CTA/footer for every cap — only the
 * eyebrow and body line change, and they're literal per the approved copy,
 * not generated, so a limit change later has to be a deliberate copy edit
 * here, not an automatic one. Updated 2026-11-24 when the owner added a
 * monthly option alongside lifetime: every body now ends "Choose a plan to
 * keep growing your skyline" instead of "Unlock lifetime...". */
export function paywallCopy(cap, counts) {
  switch (cap) {
    // Voluntary entry point (Profile's "Unlock everything" row) — none of
    // boards 87/88 cover this path with its own copy (they're all written
    // for the cap-hit moment, where "X of Y" is necessarily true). This
    // variant is a judgment call pending design-review confirmation, kept
    // factually correct regardless of how close the user actually is to
    // any cap, rather than reusing a per-cap line that could read as wrong.
    case 'browse':
      return {
        eyebrow: 'FREE PLAN',
        body: `The free plan holds ${FREE_TIER_LIMITS.daily} daily, ${FREE_TIER_LIMITS.weekly} weekly and ${FREE_TIER_LIMITS.monthly} monthly habit, plus ${FREE_SHIELD_BANK_LIMIT} Shield Days. Choose a plan to keep growing your skyline.`,
      };
    case 'monthly':
      return {
        eyebrow: `${counts.monthly} OF ${FREE_TIER_LIMITS.monthly} MONTHLY HABIT`,
        body: `Your monthly lot is in use. The free plan holds ${FREE_TIER_LIMITS.monthly} monthly habit. Choose a plan to keep growing your skyline.`,
      };
    case 'weekly':
      return {
        eyebrow: `${counts.weekly} OF ${FREE_TIER_LIMITS.weekly} WEEKLY HABIT`,
        body: `Your weekly lot is in use. The free plan holds ${FREE_TIER_LIMITS.weekly} weekly habit. Choose a plan to keep growing your skyline.`,
      };
    case 'daily':
    default:
      return {
        eyebrow: `${counts.daily} OF ${FREE_TIER_LIMITS.daily} DAILY HABITS`,
        body: `You have ${counts.daily} daily towers standing, which is what the free plan holds. Choose a plan to keep growing your skyline.`,
      };
  }
}
