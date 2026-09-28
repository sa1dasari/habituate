package com.habituate.api.habits;

import com.habituate.api.checkins.CheckIn;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Two check-ins logged on consecutive calendar days in the user's own zone
 * can land on the *same* calendar day in UTC if one is late at night and the
 * next is just after local midnight — mobile buckets by device-local time
 * (see mobile/utils/date.js), so a server computing in hardcoded UTC would
 * merge them into a single day and undercount the streak.
 */
class HabitServiceTimezoneStreakTest {

    @Test
    void longestStreak_usesCallerZone_notHardcodedUtc() {
        ZoneId pacific = ZoneId.of("America/Los_Angeles");

        Instant checkin1 = LocalDate.of(2026, 1, 10).atTime(23, 30).atZone(pacific).toInstant();
        Instant checkin2 = LocalDate.of(2026, 1, 11).atTime(0, 15).atZone(pacific).toInstant();

        // Same real 45-minute gap, but on opposite sides of Pacific local midnight.
        assertThat(checkin1.atZone(pacific).toLocalDate()).isEqualTo(LocalDate.of(2026, 1, 10));
        assertThat(checkin2.atZone(pacific).toLocalDate()).isEqualTo(LocalDate.of(2026, 1, 11));

        // In UTC (Pacific is UTC-8 in January), both instants fall on the same UTC day.
        assertThat(checkin1.atZone(ZoneOffset.UTC).toLocalDate())
                .isEqualTo(checkin2.atZone(ZoneOffset.UTC).toLocalDate());

        List<CheckIn> checkIns = List.of(
                new CheckIn(1L, "user", checkin1, 1, "manual"),
                new CheckIn(1L, "user", checkin2, 1, "manual")
        );

        Instant now = checkin2.plusSeconds(3600);

        StreakCalculator.Streaks pacificStreaks = StreakCalculator.compute(checkIns, pacific, now);
        StreakCalculator.Streaks utcStreaks = StreakCalculator.compute(checkIns, ZoneOffset.UTC, now);

        // Pacific correctly sees two consecutive local days checked in.
        assertThat(pacificStreaks.longest()).isEqualTo(2);
        assertThat(pacificStreaks.current()).isEqualTo(2);

        // Hardcoded UTC merges them into one day, undercounting the streak.
        assertThat(utcStreaks.longest()).isEqualTo(1);
    }
}
