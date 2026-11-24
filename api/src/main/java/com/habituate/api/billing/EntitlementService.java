package com.habituate.api.billing;

import com.habituate.api.users.User;
import com.habituate.api.users.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Set;

/**
 * Server-side source of truth for the v1 free tier's lifetime unlock
 * (SKYLINE.md Phase 8a, section 14 #21) — the client's RevenueCat SDK also
 * knows this locally (for the paywall UI), but entitlement checks that run
 * without a client request at all (ShieldAwardService's banking cap, which
 * fires from a check-in's streak-crossing-7 logic, not a purchase-flow
 * request) need a server-side flag, and habit-count caps need one too so a
 * modified client can't just call the API directly to bypass the limit.
 *
 * Only grants on a purchase-granting event; deliberately does not yet handle
 * a refund/cancellation event (RevenueCat's exact event type/semantics for
 * revoking a one-time, non-renewing purchase weren't looked into for this
 * pass — flagged rather than guessed, see SKYLINE.md).
 */
@Service
public class EntitlementService {

    private static final Logger log = LoggerFactory.getLogger(EntitlementService.class);

    /** Must match the entitlement identifier configured in the RevenueCat dashboard. */
    public static final String LIFETIME_ENTITLEMENT_ID = "lifetime";

    /** Free-tier caps (owner-confirmed, SKYLINE.md section 14 #21). HabitService enforces the
     * habit-count ones at creation time; ShieldAwardService enforces the shield one by capping
     * the existing bank (owner decision 2026-11-24) instead of a separate lifetime counter. */
    public static final int FREE_DAILY_HABIT_LIMIT = 5;
    public static final int FREE_WEEKLY_HABIT_LIMIT = 1;
    public static final int FREE_MONTHLY_HABIT_LIMIT = 1;
    public static final int FREE_SHIELD_BANK_LIMIT = 2;

    private static final Set<String> GRANTING_EVENT_TYPES = Set.of(
            "INITIAL_PURCHASE", "NON_RENEWING_PURCHASE", "PRODUCT_CHANGE", "UNCANCELLATION");

    private final UserRepository userRepository;

    public EntitlementService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public boolean isLifetimeUnlocked(String userId) {
        return userRepository.findById(userId).map(User::isLifetimePurchased).orElse(false);
    }

    /**
     * Looks the user up by app_user_id, falling back to original_app_user_id
     * and the aliases list (RevenueCat's own documented guidance — a
     * subscriber can accumulate multiple App User IDs over its lifetime, and
     * the most recent one isn't guaranteed to be the one this backend knows).
     * Grants are idempotent (re-applying the same event twice is harmless);
     * an event for an id this backend has never seen (no matching Firebase
     * uid, e.g. a sandbox/test event) is logged and otherwise ignored rather
     * than creating a phantom user row.
     */
    @Transactional
    public void applyWebhookEvent(RevenueCatWebhookEvent event) {
        if (event == null || event.type() == null) {
            return;
        }
        if (!GRANTING_EVENT_TYPES.contains(event.type())) {
            log.info("RevenueCat webhook: ignoring event type {}", event.type());
            return;
        }
        if (event.entitlementIds() == null || !event.entitlementIds().contains(LIFETIME_ENTITLEMENT_ID)) {
            log.info("RevenueCat webhook: {} event carries no {} entitlement, ignoring", event.type(), LIFETIME_ENTITLEMENT_ID);
            return;
        }

        List<String> candidateIds = candidateUserIds(event);
        User user = candidateIds.stream()
                .map(userRepository::findById)
                .filter(java.util.Optional::isPresent)
                .map(java.util.Optional::get)
                .findFirst()
                .orElse(null);

        if (user == null) {
            log.warn("RevenueCat webhook: no known user for app_user_id candidates {}", candidateIds);
            return;
        }
        if (user.isLifetimePurchased()) {
            return; // idempotent re-delivery
        }
        user.setLifetimePurchased(true);
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);
        log.info("RevenueCat webhook: granted lifetime entitlement to user {}", user.getId());
    }

    private List<String> candidateUserIds(RevenueCatWebhookEvent event) {
        List<String> ids = new java.util.ArrayList<>();
        if (event.appUserId() != null) ids.add(event.appUserId());
        if (event.originalAppUserId() != null) ids.add(event.originalAppUserId());
        if (event.aliases() != null) ids.addAll(event.aliases());
        return ids;
    }
}
