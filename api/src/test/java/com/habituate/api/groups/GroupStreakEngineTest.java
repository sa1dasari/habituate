package com.habituate.api.groups;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class GroupStreakEngineTest {

    @Test
    void qualifies_allMembers_requiresEveryoneCompleted() {
        assertThat(GroupStreakEngine.qualifies(Group.ALL_MEMBERS, List.of(true, true, true))).isTrue();
        assertThat(GroupStreakEngine.qualifies(Group.ALL_MEMBERS, List.of(true, false, true))).isFalse();
    }

    @Test
    void qualifies_anyMember_requiresAtLeastOne() {
        assertThat(GroupStreakEngine.qualifies(Group.ANY_MEMBER, List.of(false, false, true))).isTrue();
        assertThat(GroupStreakEngine.qualifies(Group.ANY_MEMBER, List.of(false, false, false))).isFalse();
    }

    @Test
    void qualifies_emptyMemberList_isFalse() {
        assertThat(GroupStreakEngine.qualifies(Group.ALL_MEMBERS, List.of())).isFalse();
    }

    @Test
    void recompute_startsFreshStreak_whenFirstEverQualifyingDay() {
        LocalDate today = LocalDate.of(2026, 1, 10);
        GroupStreakEngine.Result result = GroupStreakEngine.recompute(true, 0, 0, null, today);

        assertThat(result.currentStreak()).isEqualTo(1);
        assertThat(result.longestStreak()).isEqualTo(1);
        assertThat(result.lastQualifyingDate()).isEqualTo(today);
        assertThat(result.status()).isEqualTo(GroupStreak.ACTIVE);
    }

    @Test
    void recompute_continuesStreak_whenYesterdayQualified() {
        LocalDate today = LocalDate.of(2026, 1, 10);
        LocalDate yesterday = today.minusDays(1);
        GroupStreakEngine.Result result = GroupStreakEngine.recompute(true, 5, 5, yesterday, today);

        assertThat(result.currentStreak()).isEqualTo(6);
        assertThat(result.longestStreak()).isEqualTo(6);
        assertThat(result.lastQualifyingDate()).isEqualTo(today);
    }

    @Test
    void recompute_isIdempotent_whenAlreadyCountedToday() {
        LocalDate today = LocalDate.of(2026, 1, 10);
        // Simulates a second member's check-in the same day, after the first
        // already flipped qualification and this was already recorded today.
        GroupStreakEngine.Result result = GroupStreakEngine.recompute(true, 6, 6, today, today);

        assertThat(result.currentStreak()).isEqualTo(6);
        assertThat(result.longestStreak()).isEqualTo(6);
    }

    @Test
    void recompute_startsOver_whenGapSinceLastQualifyingDay() {
        LocalDate today = LocalDate.of(2026, 1, 10);
        LocalDate threeDaysAgo = today.minusDays(3);
        GroupStreakEngine.Result result = GroupStreakEngine.recompute(true, 6, 6, threeDaysAgo, today);

        assertThat(result.currentStreak()).isEqualTo(1);
        assertThat(result.longestStreak()).isEqualTo(6); // longest doesn't shrink
    }

    @Test
    void recompute_marksAtRisk_whenNotYetQualifiedButYesterdayWas() {
        LocalDate today = LocalDate.of(2026, 1, 10);
        LocalDate yesterday = today.minusDays(1);
        GroupStreakEngine.Result result = GroupStreakEngine.recompute(false, 5, 5, yesterday, today);

        assertThat(result.currentStreak()).isEqualTo(5); // unchanged — not reset here, that's the scheduler's job
        assertThat(result.status()).isEqualTo(GroupStreak.AT_RISK);
    }

    @Test
    void recompute_staysActive_whenNoStreakToLose() {
        LocalDate today = LocalDate.of(2026, 1, 10);
        GroupStreakEngine.Result result = GroupStreakEngine.recompute(false, 0, 0, null, today);

        assertThat(result.status()).isEqualTo(GroupStreak.ACTIVE);
    }
}
