package com.habituate.api.groups;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static com.habituate.api.groups.GroupCadence.Period.DAILY;
import static com.habituate.api.groups.GroupCadence.Period.MONTHLY;
import static com.habituate.api.groups.GroupCadence.Period.WEEKLY;
import static org.assertj.core.api.Assertions.assertThat;

class GroupPeriodTest {

    @Test
    void daily_periodIsJustTheDateItself() {
        LocalDate wed = LocalDate.of(2026, 11, 18);
        assertThat(GroupPeriod.periodStart(DAILY, wed)).isEqualTo(wed);
        assertThat(GroupPeriod.periodEnd(DAILY, wed)).isEqualTo(wed);
    }

    @Test
    void weekly_periodIsMondayToSunday() {
        LocalDate wed = LocalDate.of(2026, 11, 18); // a Wednesday
        assertThat(GroupPeriod.periodStart(WEEKLY, wed)).isEqualTo(LocalDate.of(2026, 11, 16)); // Monday
        assertThat(GroupPeriod.periodEnd(WEEKLY, wed)).isEqualTo(LocalDate.of(2026, 11, 22)); // Sunday
    }

    @Test
    void weekly_sundayItselfIsTheLastDayOfItsOwnWeek() {
        LocalDate sun = LocalDate.of(2026, 11, 22);
        assertThat(GroupPeriod.periodEnd(WEEKLY, sun)).isEqualTo(sun);
    }

    @Test
    void monthly_periodIsTheFullCalendarMonth() {
        LocalDate midFeb = LocalDate.of(2026, 2, 10);
        assertThat(GroupPeriod.periodStart(MONTHLY, midFeb)).isEqualTo(LocalDate.of(2026, 2, 1));
        assertThat(GroupPeriod.periodEnd(MONTHLY, midFeb)).isEqualTo(LocalDate.of(2026, 2, 28));
    }

    @Test
    void isPeriodComplete_falseWhileStillInProgress_trueOnceTodayIsPastTheEnd() {
        LocalDate wed = LocalDate.of(2026, 11, 18);
        assertThat(GroupPeriod.isPeriodComplete(WEEKLY, wed, LocalDate.of(2026, 11, 20))).isFalse(); // still this week
        assertThat(GroupPeriod.isPeriodComplete(WEEKLY, wed, LocalDate.of(2026, 11, 22))).isFalse(); // Sunday itself, not yet past
        assertThat(GroupPeriod.isPeriodComplete(WEEKLY, wed, LocalDate.of(2026, 11, 23))).isTrue(); // next Monday
    }
}
