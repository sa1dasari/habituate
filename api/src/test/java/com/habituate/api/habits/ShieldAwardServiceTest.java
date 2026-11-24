package com.habituate.api.habits;

import com.habituate.api.billing.EntitlementService;
import com.habituate.api.groups.StreakFreeze;
import com.habituate.api.groups.StreakFreezeRepository;
import com.habituate.api.users.User;
import com.habituate.api.users.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class ShieldAwardServiceTest {

    @Autowired
    private ShieldAwardService shieldAwardService;

    @Autowired
    private ShieldAwardRepository shieldAwardRepository;

    @Autowired
    private StreakFreezeRepository streakFreezeRepository;

    @Autowired
    private UserRepository userRepository;

    private String userId;

    // Deletes one by one via each repository's base deleteById (transactional
    // on its own) rather than the bulk deleteByUserId under test — a bare
    // derived delete query called outside a @Transactional service method
    // has no transaction to run in.
    @AfterEach
    void cleanup() {
        if (userId != null) {
            shieldAwardRepository.findAll().stream()
                    .filter(a -> userId.equals(a.getUserId()))
                    .forEach(a -> shieldAwardRepository.deleteById(a.getId()));
            streakFreezeRepository.findAll().stream()
                    .filter(f -> userId.equals(f.getUserId()))
                    .forEach(f -> streakFreezeRepository.deleteById(f.getId()));
            userRepository.findById(userId).ifPresent(u -> userRepository.deleteById(userId));
        }
    }

    @Test
    void awardIfEligible_grantsOnFirstMultipleOfSeven() {
        userId = "shield-award-test-user-1";
        shieldAwardService.awardIfEligible(userId, 100L, 7);
        assertThat(shieldAwardService.getAvailable(userId)).isEqualTo(1);
    }

    @Test
    void awardIfEligible_doesNothingForNonMilestoneStreak() {
        userId = "shield-award-test-user-2";
        shieldAwardService.awardIfEligible(userId, 100L, 5);
        assertThat(shieldAwardService.getAvailable(userId)).isEqualTo(0);
    }

    @Test
    void awardIfEligible_doesNotDoubleAwardTheSameMilestone() {
        userId = "shield-award-test-user-3";
        shieldAwardService.awardIfEligible(userId, 100L, 7);
        shieldAwardService.awardIfEligible(userId, 100L, 7); // same habit, same streak length, e.g. re-fetched twice
        assertThat(shieldAwardService.getAvailable(userId)).isEqualTo(1);
    }

    @Test
    void awardIfEligible_capsBankedShieldsAtTheFreeTierLimit() {
        userId = "shield-award-test-user-4";
        shieldAwardService.awardIfEligible(userId, 100L, 7);
        shieldAwardService.awardIfEligible(userId, 100L, 14);
        shieldAwardService.awardIfEligible(userId, 100L, 21); // would be a 3rd — over the free-tier cap of 2
        assertThat(shieldAwardService.getAvailable(userId)).isEqualTo(EntitlementService.FREE_SHIELD_BANK_LIMIT);
    }

    @Test
    void awardIfEligible_lifetimeUnlockedUserHasNoCap() {
        userId = "shield-award-test-user-6";
        User user = new User(userId, null);
        user.setLifetimePurchased(true);
        userRepository.save(user);

        shieldAwardService.awardIfEligible(userId, 100L, 7);
        shieldAwardService.awardIfEligible(userId, 100L, 14);
        shieldAwardService.awardIfEligible(userId, 100L, 21); // would be capped at 2 on the free tier, not here
        assertThat(shieldAwardService.getAvailable(userId)).isEqualTo(3);
    }

    @Test
    void getAvailable_subtractsPersonalFreezesAlreadySpent() {
        userId = "shield-award-test-user-5";
        shieldAwardService.awardIfEligible(userId, 100L, 7);
        shieldAwardService.awardIfEligible(userId, 100L, 14);
        streakFreezeRepository.save(new StreakFreeze(userId, 100L, LocalDate.now(), StreakFreeze.PERSONAL_GRACE));

        assertThat(shieldAwardService.getAvailable(userId)).isEqualTo(1);
    }
}
