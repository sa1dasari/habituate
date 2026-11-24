package com.habituate.api.billing;

import com.habituate.api.users.User;
import com.habituate.api.users.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

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

    @Test
    void isLifetimeUnlocked_defaultsFalseForAnUnknownUser() {
        assertThat(entitlementService.isLifetimeUnlocked("entitlement-test-unknown-user")).isFalse();
    }

    @Test
    void applyWebhookEvent_grantsOnANonRenewingPurchaseOfTheLifetimeEntitlement() {
        userId = "entitlement-test-user-1";
        userRepository.save(new User(userId, null));

        entitlementService.applyWebhookEvent(new RevenueCatWebhookEvent(
                "NON_RENEWING_PURCHASE", userId, null, null, List.of(EntitlementService.LIFETIME_ENTITLEMENT_ID)));

        assertThat(entitlementService.isLifetimeUnlocked(userId)).isTrue();
    }

    @Test
    void applyWebhookEvent_ignoresAnEventForAnUnrelatedEntitlement() {
        userId = "entitlement-test-user-2";
        userRepository.save(new User(userId, null));

        entitlementService.applyWebhookEvent(new RevenueCatWebhookEvent(
                "NON_RENEWING_PURCHASE", userId, null, null, List.of("some_other_entitlement")));

        assertThat(entitlementService.isLifetimeUnlocked(userId)).isFalse();
    }

    @Test
    void applyWebhookEvent_ignoresAnEventTypeThatDoesNotGrant() {
        userId = "entitlement-test-user-3";
        userRepository.save(new User(userId, null));

        entitlementService.applyWebhookEvent(new RevenueCatWebhookEvent(
                "CANCELLATION", userId, null, null, List.of(EntitlementService.LIFETIME_ENTITLEMENT_ID)));

        assertThat(entitlementService.isLifetimeUnlocked(userId)).isFalse();
    }

    @Test
    void applyWebhookEvent_fallsBackToOriginalAppUserIdWhenAppUserIdIsUnknown() {
        userId = "entitlement-test-user-4";
        userRepository.save(new User(userId, null));

        entitlementService.applyWebhookEvent(new RevenueCatWebhookEvent(
                "INITIAL_PURCHASE", "some-anonymous-rc-id", userId, null,
                List.of(EntitlementService.LIFETIME_ENTITLEMENT_ID)));

        assertThat(entitlementService.isLifetimeUnlocked(userId)).isTrue();
    }

    @Test
    void applyWebhookEvent_isIdempotentOnRedelivery() {
        userId = "entitlement-test-user-5";
        userRepository.save(new User(userId, null));
        RevenueCatWebhookEvent event = new RevenueCatWebhookEvent(
                "NON_RENEWING_PURCHASE", userId, null, null, List.of(EntitlementService.LIFETIME_ENTITLEMENT_ID));

        entitlementService.applyWebhookEvent(event);
        entitlementService.applyWebhookEvent(event);

        assertThat(entitlementService.isLifetimeUnlocked(userId)).isTrue();
    }
}
