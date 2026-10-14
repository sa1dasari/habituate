package com.habituate.api.habits;

import com.habituate.api.checkins.CheckInRequest;
import com.habituate.api.events.CheckInEventPublisher;
import com.habituate.api.groups.StreakFreeze;
import com.habituate.api.groups.StreakFreezeRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class PersonalStreakFreezeSchedulerTest {

    @Autowired
    private HabitService habitService;

    @Autowired
    private HabitRepository habitRepository;

    @Autowired
    private PersonalStreakFreezeScheduler scheduler;

    @Autowired
    private StreakFreezeRepository streakFreezeRepository;

    @Autowired
    private ShieldAwardRepository shieldAwardRepository;

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

    private Habit createHabitWithTodayCheckIn(String uid) {
        userId = uid;
        HabitResponse habit = habitService.createHabit(userId, new CreateHabitRequest(
                "Test Habit", "General", "DAILY", 1, null, null, "BOOLEAN", null, null, null, null));
        habitId = habit.id();
        habitService.createCheckIn(userId, habitId, new CheckInRequest(Instant.now(), 1, "manual"));
        return habitRepository.findById(habitId).orElseThrow();
    }

    @Test
    void appliesShieldFreeze_whenStreakActiveAndShieldAvailable() {
        Habit habit = createHabitWithTodayCheckIn("personal-freeze-test-user-1");
        shieldAwardRepository.save(new ShieldAward(userId, habitId, 7));

        LocalDate gapDay = LocalDate.now(ZoneOffset.UTC).plusDays(1);
        scheduler.evaluateHabit(habit, gapDay);

        StreakFreeze freeze = streakFreezeRepository.findByHabitIdAndUsedOnDate(habitId, gapDay).orElseThrow();
        assertThat(freeze.getSource()).isEqualTo(StreakFreeze.PERSONAL_GRACE);
        assertThat(freeze.getUserId()).isEqualTo(userId);

        assertThat(habitService.getShieldsAvailable(userId)).isEqualTo(0); // the one shield just got spent
    }

    @Test
    void doesNothing_whenNoShieldAvailable() {
        Habit habit = createHabitWithTodayCheckIn("personal-freeze-test-user-2");
        // no ShieldAward granted

        LocalDate gapDay = LocalDate.now(ZoneOffset.UTC).plusDays(1);
        scheduler.evaluateHabit(habit, gapDay);

        assertThat(streakFreezeRepository.findByHabitIdAndUsedOnDate(habitId, gapDay)).isEmpty();
    }

    @Test
    void doesNothing_whenNoActiveStreakToProtect() {
        userId = "personal-freeze-test-user-3";
        HabitResponse created = habitService.createHabit(userId, new CreateHabitRequest(
                "Test Habit", "General", "DAILY", 1, null, null, "BOOLEAN", null, null, null, null));
        habitId = created.id();
        Habit habit = habitRepository.findById(habitId).orElseThrow();
        shieldAwardRepository.save(new ShieldAward(userId, habitId, 7));

        LocalDate gapDay = LocalDate.now(ZoneOffset.UTC).plusDays(1);
        scheduler.evaluateHabit(habit, gapDay); // no check-ins at all — nothing to protect

        assertThat(streakFreezeRepository.findByHabitIdAndUsedOnDate(habitId, gapDay)).isEmpty();
    }

    @Test
    void doesNothing_whenAlreadyCheckedInThatDay() {
        Habit habit = createHabitWithTodayCheckIn("personal-freeze-test-user-4");
        shieldAwardRepository.save(new ShieldAward(userId, habitId, 7));

        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        scheduler.evaluateHabit(habit, today); // already checked in today

        assertThat(streakFreezeRepository.findByHabitIdAndUsedOnDate(habitId, today)).isEmpty();
        assertThat(habitService.getShieldsAvailable(userId)).isEqualTo(1); // not spent
    }
}
