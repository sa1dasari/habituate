package com.habituate.api.habits;

import com.habituate.api.checkins.CheckIn;
import com.habituate.api.checkins.CheckInRequest;
import com.habituate.api.common.DuplicateCheckInException;
import com.habituate.api.events.CheckInEventPublisher;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * A fixed "local noon" timestamp alone isn't safe for every real-world UTC
 * offset — Pacific/Kiribati is UTC+14, so local noon on day D is already
 * 22:00 UTC on day D-1. Without bucketing in the client's own zone, the
 * duplicate-check-in guard would use the wrong day and let a second
 * "same local day" check-in through (or reject a legitimate one).
 */
@SpringBootTest
class HabitServiceCheckInTimezoneTest {

    @Autowired
    private HabitService habitService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockBean
    private CheckInEventPublisher checkInEventPublisher;

    private String userId;
    private Long habitId;

    @AfterEach
    void cleanup() {
        if (habitId != null) {
            habitService.deleteHabit(userId, habitId);
        }
    }

    @Test
    void duplicateGuard_usesClientZone_notHardcodedUtc() {
        userId = "tz-checkin-test-user";
        habitId = habitService.createHabit(userId, new CreateHabitRequest(
                "Test Habit", "General", "DAILY", 1, null, null, "BOOLEAN", null, null, null)).id();

        // The habit's own createdAt guard would otherwise reject backdating
        // 5 days on a habit created "just now" — JPA won't update createdAt
        // via the entity API (updatable = false), so this bypasses it directly.
        jdbcTemplate.update(
                "UPDATE habits SET created_at = ? WHERE id = ?",
                Timestamp.from(Instant.now().minus(30, ChronoUnit.DAYS)),
                habitId);

        ZoneId kiribati = ZoneId.of("Pacific/Kiritimati"); // UTC+14
        // A fixed past day, not "today" — using today's date risks the test's
        // own evening timestamp below landing in the future relative to the
        // real clock, depending what time the test happens to run.
        LocalDate localDay = LocalDate.now(kiribati).minusDays(5);
        Instant localNoon = localDay.atTime(12, 0).atZone(kiribati).toInstant();

        // Confirm this instant really does land on the previous UTC day —
        // the exact scenario a fixed "noon" heuristic alone can't handle.
        assertThat(localNoon.atZone(java.time.ZoneOffset.UTC).toLocalDate()).isBefore(localDay);

        CheckIn first = habitService.createCheckIn(
                userId, habitId, new CheckInRequest(localNoon, 1, "manual"), "Pacific/Kiritimati");
        assertThat(first).isNotNull();

        // A second check-in later the same Kiribati day must still be
        // rejected as a duplicate when the server is told the same zone.
        Instant localEvening = localDay.atTime(20, 0).atZone(kiribati).toInstant();
        assertThatThrownBy(() ->
                habitService.createCheckIn(
                        userId, habitId, new CheckInRequest(localEvening, 1, "manual"), "Pacific/Kiritimati")
        ).isInstanceOf(DuplicateCheckInException.class);
    }
}
