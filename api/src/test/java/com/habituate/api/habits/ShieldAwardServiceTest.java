package com.habituate.api.habits;

import com.habituate.api.groups.StreakFreeze;
import com.habituate.api.groups.StreakFreezeRepository;
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
    void awardIfEligible_capsBankedShields() {
        userId = "shield-award-test-user-4";
        shieldAwardService.awardIfEligible(userId, 100L, 7);
        shieldAwardService.awardIfEligible(userId, 100L, 14);
        shieldAwardService.awardIfEligible(userId, 100L, 21);
        shieldAwardService.awardIfEligible(userId, 100L, 28); // would be a 4th — over the cap of 3
        assertThat(shieldAwardService.getAvailable(userId)).isEqualTo(ShieldAwardService.MAX_BANKED);
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
