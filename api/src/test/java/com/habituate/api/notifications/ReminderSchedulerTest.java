package com.habituate.api.notifications;

import com.habituate.api.checkins.CheckIn;
import com.habituate.api.checkins.CheckInRepository;
import com.habituate.api.habits.CreateHabitRequest;
import com.habituate.api.habits.HabitService;
import com.habituate.api.users.User;
import com.habituate.api.users.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@SpringBootTest
class ReminderSchedulerTest {

    @Autowired
    private ReminderScheduler reminderScheduler;

    @Autowired
    private HabitService habitService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PushTokenRepository pushTokenRepository;

    @MockBean
    private ExpoPushService expoPushService;

    @Autowired
    private CheckInRepository checkInRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private String userId;
    private Long habitId;
    private String token;

    @AfterEach
    void cleanup() {
        if (habitId != null) {
            habitService.deleteHabit(userId, habitId);
        }
        if (userId != null) {
            userRepository.deleteById(userId);
        }
        if (token != null) {
            pushTokenRepository.findByToken(token).ifPresent(pushTokenRepository::delete);
        }
    }

    @Test
    void sendsReminder_whenScheduledTimeMatchesUsersLocalTime() {
        userId = "reminder-test-user-1";
        ZoneId zone = ZoneId.of("America/New_York");
        userRepository.save(new User(userId, zone.getId()));

        token = "ExponentPushToken[reminder-test-1]";
        pushTokenRepository.save(new PushToken(userId, token, "ios"));

        Instant now = ZonedDateTime.now(zone).withHour(7).withMinute(30).withSecond(0).withNano(0).toInstant();
        LocalTime scheduled = now.atZone(zone).toLocalTime();

        habitId = habitService.createHabit(userId, new CreateHabitRequest(
                "Morning Walk", "General", "DAILY", 1, null, null, "BOOLEAN", null,
                scheduled.toString().substring(0, 5), true)).id();

        reminderScheduler.sendDueReminders(now);

        ArgumentCaptor<List<ExpoPushMessage>> captor = ArgumentCaptor.forClass(List.class);
        verify(expoPushService).send(captor.capture());
        assertThat(captor.getValue()).hasSize(1);
        assertThat(captor.getValue().get(0).to()).isEqualTo(token);
        assertThat(captor.getValue().get(0).title()).contains("Morning Walk");
    }

    @Test
    void sendsStreakAwareBody_whenStreakMeetsThreshold() {
        userId = "reminder-test-user-4";
        ZoneId zone = ZoneId.of("America/New_York");
        userRepository.save(new User(userId, zone.getId()));

        token = "ExponentPushToken[reminder-test-4]";
        pushTokenRepository.save(new PushToken(userId, token, "ios"));

        Instant now = ZonedDateTime.now(zone).withHour(7).withMinute(30).withSecond(0).withNano(0).toInstant();
        LocalTime scheduled = now.atZone(zone).toLocalTime();

        habitId = habitService.createHabit(userId, new CreateHabitRequest(
                "Morning Walk", "General", "DAILY", 1, null, null, "BOOLEAN", null,
                scheduled.toString().substring(0, 5), true)).id();
        // Backdate createdAt so a multi-day check-in history is valid -- JPA won't
        // update it via the entity API (updatable = false), same jdbcTemplate
        // bypass HabitServiceCheckInTimezoneTest/HabitServiceStreakRepairTest use.
        jdbcTemplate.update("UPDATE habits SET created_at = ? WHERE id = ?",
                Timestamp.from(now.minus(30, ChronoUnit.DAYS)), habitId);
        for (int daysAgo = 1; daysAgo <= 3; daysAgo++) {
            checkInRepository.save(new CheckIn(habitId, userId, now.minus(daysAgo, ChronoUnit.DAYS), 1, "manual"));
        }

        reminderScheduler.sendDueReminders(now);

        ArgumentCaptor<List<ExpoPushMessage>> captor = ArgumentCaptor.forClass(List.class);
        verify(expoPushService).send(captor.capture());
        assertThat(captor.getValue().get(0).body()).contains("3-day streak");
    }

    @Test
    void skipsReminder_whenTimeDoesNotMatch() {
        userId = "reminder-test-user-2";
        ZoneId zone = ZoneId.of("America/New_York");
        userRepository.save(new User(userId, zone.getId()));

        token = "ExponentPushToken[reminder-test-2]";
        pushTokenRepository.save(new PushToken(userId, token, "ios"));

        habitId = habitService.createHabit(userId, new CreateHabitRequest(
                "Evening Read", "General", "DAILY", 1, null, null, "BOOLEAN", null, "21:00", true)).id();

        Instant notScheduledTime = ZonedDateTime.now(zone).withHour(9).withMinute(0).withSecond(0).withNano(0)
                .toInstant();
        reminderScheduler.sendDueReminders(notScheduledTime);

        verify(expoPushService, never()).send(anyList());
    }

    @Test
    void skipsReminder_whenUserHasNoRecordedTimezone() {
        userId = "reminder-test-user-3";
        // Deliberately not saving a User row — no known timezone yet.

        token = "ExponentPushToken[reminder-test-3]";
        pushTokenRepository.save(new PushToken(userId, token, "ios"));

        habitId = habitService.createHabit(userId, new CreateHabitRequest(
                "Stretch", "General", "DAILY", 1, null, null, "BOOLEAN", null, "08:00", true)).id();

        reminderScheduler.sendDueReminders(Instant.now());

        verify(expoPushService, never()).send(anyList());
    }
}
