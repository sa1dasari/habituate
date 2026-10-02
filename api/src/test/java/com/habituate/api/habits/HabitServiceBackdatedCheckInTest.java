package com.habituate.api.habits;

import com.habituate.api.checkins.CheckIn;
import com.habituate.api.checkins.CheckInRequest;
import com.habituate.api.events.CheckInEventPublisher;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * A check-in can be backdated as far back as the habit's own createdAt (the
 * calendar's day-detail panel lets a user tap a past day and log it), but
 * not before the habit existed, and never into the future.
 */
@SpringBootTest
class HabitServiceBackdatedCheckInTest {

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
    void createCheckIn_allowsBackdatingToTheDayTheHabitWasCreated() {
        userId = "backdate-test-user";
        HabitResponse habit = habitService.createHabit(userId, new CreateHabitRequest(
                "Test Habit", "General", "DAILY", 1, null, null, "BOOLEAN", null, null, null));
        habitId = habit.id();

        CheckIn checkIn = habitService.createCheckIn(
                userId, habitId, new CheckInRequest(habit.createdAt(), 1, "manual"));

        assertThat(checkIn.getOccurredAt()).isEqualTo(habit.createdAt());
    }

    @Test
    void createCheckIn_rejectsBackdatingBeforeTheHabitExisted() {
        userId = "backdate-test-user";
        HabitResponse habit = habitService.createHabit(userId, new CreateHabitRequest(
                "Test Habit", "General", "DAILY", 1, null, null, "BOOLEAN", null, null, null));
        habitId = habit.id();

        Instant beforeCreation = habit.createdAt().minus(1, ChronoUnit.DAYS);

        assertThatThrownBy(() ->
                habitService.createCheckIn(userId, habitId, new CheckInRequest(beforeCreation, 1, "manual"))
        ).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void createCheckIn_rejectsFutureDates() {
        userId = "backdate-test-user";
        habitId = habitService.createHabit(userId, new CreateHabitRequest(
                "Test Habit", "General", "DAILY", 1, null, null, "BOOLEAN", null, null, null)).id();

        Instant tomorrow = Instant.now().plus(1, ChronoUnit.DAYS);

        assertThatThrownBy(() ->
                habitService.createCheckIn(userId, habitId, new CheckInRequest(tomorrow, 1, "manual"))
        ).isInstanceOf(IllegalArgumentException.class);
    }
}
