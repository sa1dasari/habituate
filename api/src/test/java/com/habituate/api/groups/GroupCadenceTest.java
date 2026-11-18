package com.habituate.api.groups;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class GroupCadenceTest {

    @Test
    void classify_plainDailyHabit_isDaily() {
        var result = GroupCadence.classify("DAILY", 1, null, null);
        assertThat(result.period()).isEqualTo(GroupCadence.Period.DAILY);
        assertThat(result.target()).isEqualTo(1);
    }

    @Test
    void classify_weeklyTargetSet_isWeekly_regardlessOfCadenceType() {
        var result = GroupCadence.classify("DAILY", 1, 3, null);
        assertThat(result.period()).isEqualTo(GroupCadence.Period.WEEKLY);
        assertThat(result.target()).isEqualTo(3);
    }

    @Test
    void classify_cadenceTypeWeekly_withNoExplicitWeeklyTarget_fallsBackToCadenceTarget() {
        var result = GroupCadence.classify("WEEKLY", 4, null, null);
        assertThat(result.period()).isEqualTo(GroupCadence.Period.WEEKLY);
        assertThat(result.target()).isEqualTo(4);
    }

    @Test
    void classify_monthlyTargetSet_isMonthly() {
        var result = GroupCadence.classify("DAILY", 1, null, 10);
        assertThat(result.period()).isEqualTo(GroupCadence.Period.MONTHLY);
        assertThat(result.target()).isEqualTo(10);
    }

    @Test
    void classify_bothWeeklyAndMonthlySet_weeklyWins() {
        var result = GroupCadence.classify("DAILY", 1, 3, 10);
        assertThat(result.period()).isEqualTo(GroupCadence.Period.WEEKLY);
        assertThat(result.target()).isEqualTo(3);
    }

    @Test
    void classify_zeroOrNegativeWeeklyTarget_isIgnored() {
        var result = GroupCadence.classify("DAILY", 1, 0, null);
        assertThat(result.period()).isEqualTo(GroupCadence.Period.DAILY);
    }
}
