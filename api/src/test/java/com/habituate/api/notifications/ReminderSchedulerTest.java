package com.habituate.api.notifications;

import com.habituate.api.events.CheckInEventPublisher;
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

import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
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
    private CheckInEventPublisher checkInEventPublisher;

    @MockBean
    private ExpoPushService expoPushService;

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
