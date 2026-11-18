package com.habituate.api.habits;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/** TowerCap — pure day arithmetic, no Spring or database. */
class TowerCapTest {

    private static final ZoneId UTC = ZoneOffset.UTC;
    private static final ZoneId TOKYO = ZoneId.of("Asia/Tokyo");
    private static final ZoneId NEW_YORK = ZoneId.of("America/New_York");

    private static Instant at(ZoneId zone, int y, int m, int d, int h) {
        return ZonedDateTime.of(y, m, d, h, 0, 0, 0, zone).toInstant();
    }

    @Test
    void aTowerReachesItsCapAtTheLocalMidnightThatStartsDayStartPlusCap() {
        // Started mid-afternoon on Nov 1 with a 30-day cap: floors Nov 1..Nov 30,
        // tops out at local midnight starting Dec 1.
        Instant boundary = TowerCap.boundary(at(UTC, 2026, 11, 1, 15), 30, UTC);

        assertThat(boundary).isEqualTo(at(UTC, 2026, 12, 1, 0));
    }

    @Test
    void theBoundaryFollowsTheOwnersTimezoneNotUtc() {
        // 20:00 UTC on Nov 1 is already Nov 2 in Tokyo, so the tower started on
        // Nov 2 there and a 3-day cap ends at Tokyo midnight starting Nov 5.
        Instant start = at(UTC, 2026, 11, 1, 20);

        Instant boundary = TowerCap.boundary(start, 3, TOKYO);

        assertThat(boundary).isEqualTo(at(TOKYO, 2026, 11, 5, 0));
    }

    @Test
    void aOneDayCapEndsAtTheNextLocalMidnight() {
        assertThat(TowerCap.boundary(at(UTC, 2026, 11, 1, 23), 1, UTC)).isEqualTo(at(UTC, 2026, 11, 2, 0));
    }

    @Test
    void noBoundaryHasPassedBeforeTheCapIsReached() {
        Instant start = at(UTC, 2026, 11, 1, 9);

        assertThat(TowerCap.latestDueBoundary(start, 30, UTC, at(UTC, 2026, 11, 30, 23))).isEmpty();
    }

    @Test
    void theBoundaryItselfCountsAsDue() {
        Instant start = at(UTC, 2026, 11, 1, 9);
        Instant boundary = at(UTC, 2026, 12, 1, 0);

        assertThat(TowerCap.latestDueBoundary(start, 30, UTC, boundary)).contains(boundary);
    }

    @Test
    void severalMissedCapsCollapseIntoOneTopOutAtTheMostRecentBoundary() {
        // Started Sep 1, cap 30: boundaries Oct 1, Oct 31, Nov 30. On Dec 5 the
        // latest passed one is Nov 30, and that is the only one returned.
        Instant start = at(UTC, 2026, 9, 1, 12);

        assertThat(TowerCap.latestDueBoundary(start, 30, UTC, at(UTC, 2026, 12, 5, 12)))
                .contains(at(UTC, 2026, 11, 30, 0));
    }

    @Test
    void aDaylightSavingChangeDoesNotShiftTheLocalMidnight() {
        // US clocks go back on 2026-11-01. A tower started Oct 31 with a 5-day
        // cap still ends at New York midnight starting Nov 5 (05:00 UTC, after the change).
        Instant boundary = TowerCap.boundary(at(NEW_YORK, 2026, 10, 31, 12), 5, NEW_YORK);

        assertThat(boundary).isEqualTo(at(NEW_YORK, 2026, 11, 5, 0));
        assertThat(boundary.atZone(UTC).toLocalDate()).isEqualTo(LocalDate.of(2026, 11, 5));
    }

    @Test
    void aStoredCapOutsideTheValidRangeIsReadAsTheNearestValidOne() {
        assertThat(TowerCap.effectiveCap(3650)).isEqualTo(35);
        assertThat(TowerCap.effectiveCap(0)).isEqualTo(1);
        assertThat(TowerCap.effectiveCap(30)).isEqualTo(30);
    }

    @Test
    void validCapsAreOneThroughThirtyFive() {
        assertThat(TowerCap.isValidCap(1)).isTrue();
        assertThat(TowerCap.isValidCap(35)).isTrue();
        assertThat(TowerCap.isValidCap(0)).isFalse();
        assertThat(TowerCap.isValidCap(36)).isFalse();
    }
}
