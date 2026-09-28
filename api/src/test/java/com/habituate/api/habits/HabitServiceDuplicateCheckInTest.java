package com.habituate.api.habits;

import com.habituate.api.checkins.CheckInRequest;
import com.habituate.api.common.DuplicateCheckInException;
import com.habituate.api.events.CheckInEventPublisher;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * BOOLEAN habits are meant to be a single toggle per day (see Habit.java's
 * doc comment) — a double-tap or a client retry must not create a second row.
 * COUNT habits are unaffected: they're explicitly allowed multiple check-ins
 * a day by design.
 */
@SpringBootTest
class HabitServiceDuplicateCheckInTest {

    @Autowired
    private HabitService habitService;

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
    void createCheckIn_rejectsSecondCheckInSameDay_forBooleanHabit() {
        userId = "duplicate-checkin-test-user";
        habitId = habitService.createHabit(userId, new CreateHabitRequest(
                "Test Habit", "General", "DAILY", 1, null, null, "BOOLEAN", null, null, null
        )).id();

        habitService.createCheckIn(userId, habitId, new CheckInRequest(null, 1, "manual"));

        assertThatThrownBy(() ->
                habitService.createCheckIn(userId, habitId, new CheckInRequest(null, 1, "manual"))
        ).isInstanceOf(DuplicateCheckInException.class);
    }

    @Test
    void createCheckIn_allowsMultipleCheckInsSameDay_forCountHabit() {
        userId = "duplicate-checkin-test-user";
        habitId = habitService.createHabit(userId, new CreateHabitRequest(
                "Test Habit", "General", "DAILY", 1, null, null, "COUNT", null, null, null
        )).id();

        habitService.createCheckIn(userId, habitId, new CheckInRequest(null, 5, "manual"));
        habitService.createCheckIn(userId, habitId, new CheckInRequest(null, 3, "manual"));
    }
}
