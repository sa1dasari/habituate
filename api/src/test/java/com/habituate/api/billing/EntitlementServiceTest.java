package com.habituate.api.billing;

import com.habituate.api.users.User;
import com.habituate.api.users.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class EntitlementServiceTest {

    @Autowired
    private EntitlementService entitlementService;

    @Autowired
    private UserRepository userRepository;

    private String userId;

    @AfterEach
    void cleanup() {
        if (userId != null) {
            userRepository.findById(userId).ifPresent(u -> userRepository.deleteById(userId));
        }
    }

    /** expirationAtMs null — the lifetime (non-expiring) purchase path. */
    private RevenueCatWebhookEvent lifetimeEvent(String type, String appUserId, String originalAppUserId, List<String> entitlementIds) {
        return new RevenueCatWebhookEvent(type, appUserId, originalAppUserId, null, entitlementIds, null);
    }

    /** expirationAtMs set — the monthly subscription purchase/renewal path. */
    private RevenueCatWebhookEvent subscriptionEvent(String type, String appUserId, long expirationAtMs) {
        return new RevenueCatWebhookEvent(type, appUserId, null, null, List.of(EntitlementService.PRO_ENTITLEMENT_ID), expirationAtMs);
    }

    @Test
    void isEntitled_defaultsFalseForAnUnknownUser() {
        assertThat(entitlementService.isEntitled("entitlement-test-unknown-user")).isFalse();
    }

    @Test
    void applyWebhookEvent_grantsLifetimeOnANonRenewingPurchase() {
        userId = "entitlement-test-user-1";
        userRepository.save(new User(userId, null));

        entitlementService.applyWebhookEvent(
                lifetimeEvent("NON_RENEWING_PURCHASE", userId, null, List.of(EntitlementService.PRO_ENTITLEMENT_ID)));

        assertThat(entitlementService.isEntitled(userId)).isTrue();
    }

    @Test
    void applyWebhookEvent_ignoresAnEventForAnUnrelatedEntitlement() {
        userId = "entitlement-test-user-2";
        userRepository.save(new User(userId, null));

        entitlementService.applyWebhookEvent(
                lifetimeEvent("NON_RENEWING_PURCHASE", userId, null, List.of("some_other_entitlement")));

        assertThat(entitlementService.isEntitled(userId)).isFalse();
    }

    @Test
    void applyWebhookEvent_ignoresAnEventTypeThatDoesNotGrant() {
        userId = "entitlement-test-user-3";
        userRepository.save(new User(userId, null));

        entitlementService.applyWebhookEvent(
                lifetimeEvent("CANCELLATION", userId, null, List.of(EntitlementService.PRO_ENTITLEMENT_ID)));

        assertThat(entitlementService.isEntitled(userId)).isFalse();
    }

    @Test
    void applyWebhookEvent_fallsBackToOriginalAppUserIdWhenAppUserIdIsUnknown() {
        userId = "entitlement-test-user-4";
        userRepository.save(new User(userId, null));

        entitlementService.applyWebhookEvent(
                lifetimeEvent("INITIAL_PURCHASE", "some-anonymous-rc-id", userId, List.of(EntitlementService.PRO_ENTITLEMENT_ID)));

        assertThat(entitlementService.isEntitled(userId)).isTrue();
    }

    @Test
    void applyWebhookEvent_isIdempotentOnLifetimeRedelivery() {
        userId = "entitlement-test-user-5";
        userRepository.save(new User(userId, null));
        RevenueCatWebhookEvent event =
                lifetimeEvent("NON_RENEWING_PURCHASE", userId, null, List.of(EntitlementService.PRO_ENTITLEMENT_ID));

        entitlementService.applyWebhookEvent(event);
        entitlementService.applyWebhookEvent(event);

        assertThat(entitlementService.isEntitled(userId)).isTrue();
    }

    @Test
    void applyWebhookEvent_grantsASubscriptionUntilItsExpirationDate() {
        userId = "entitlement-test-user-6";
        userRepository.save(new User(userId, null));
        long future = Instant.now().plusSeconds(30L * 86400).toEpochMilli();

        entitlementService.applyWebhookEvent(subscriptionEvent("INITIAL_PURCHASE", userId, future));

        assertThat(entitlementService.isEntitled(userId)).isTrue();
    }

    @Test
    void isEntitled_isFalseOnceASubscriptionsExpirationDateHasPassed() {
        userId = "entitlement-test-user-7";
        User user = new User(userId, null);
        user.setSubscriptionActiveUntil(Instant.now().minusSeconds(3600));
        userRepository.save(user);

        // No explicit EXPIRATION handling needed — isEntitled is a live date
        // check, so a past subscriptionActiveUntil just stops passing on its own.
        assertThat(entitlementService.isEntitled(userId)).isFalse();
    }

    @Test
    void applyWebhookEvent_renewalExtendsTheSubscription() {
        userId = "entitlement-test-user-8";
        User user = new User(userId, null);
        user.setSubscriptionActiveUntil(Instant.now().plusSeconds(60));
        userRepository.save(user);
        long future = Instant.now().plusSeconds(30L * 86400).toEpochMilli();

        entitlementService.applyWebhookEvent(subscriptionEvent("RENEWAL", userId, future));

        User reloaded = userRepository.findById(userId).orElseThrow();
        assertThat(reloaded.getSubscriptionActiveUntil().toEpochMilli()).isEqualTo(future);
    }

    @Test
    void isEntitled_lifetimeAndSubscriptionAreIndependentPaths() {
        userId = "entitlement-test-user-9";
        User user = new User(userId, null);
        user.setLifetimePurchased(true);
        user.setSubscriptionActiveUntil(Instant.now().minusSeconds(3600)); // lapsed subscription
        userRepository.save(user);

        // Lifetime alone is enough, regardless of the lapsed subscription field.
        assertThat(entitlementService.isEntitled(userId)).isTrue();
    }
}
