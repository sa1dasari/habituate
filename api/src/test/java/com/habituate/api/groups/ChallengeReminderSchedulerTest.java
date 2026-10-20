package com.habituate.api.groups;

import com.habituate.api.notifications.ExpoPushMessage;
import com.habituate.api.notifications.ExpoPushService;
import com.habituate.api.notifications.PushToken;
import com.habituate.api.notifications.PushTokenRepository;
import com.habituate.api.users.User;
import com.habituate.api.users.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Mirrors notifications.ReminderSchedulerTest's shape, for the challenge-reminder sweep instead
 * of the habit-reminder one. */
@SpringBootTest
class ChallengeReminderSchedulerTest {

    @Autowired
    private ChallengeReminderScheduler challengeReminderScheduler;

    @Autowired
    private ChallengeService challengeService;

    @Autowired
    private ChallengeRepository challengeRepository;

    @Autowired
    private ChallengeParticipantRepository participantRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PushTokenRepository pushTokenRepository;

    @MockBean
    private UserLookupService userLookupService;

    @MockBean
    private FriendshipService friendshipService;

    @MockBean
    private ExpoPushService expoPushService;

    private String userId;
    private Long challengeId;
    private String token;

    @AfterEach
    void cleanup() {
        if (challengeId != null) {
            participantRepository.findByChallengeId(challengeId)
                    .forEach(p -> participantRepository.deleteById(p.getId()));
            challengeRepository.deleteById(challengeId);
        }
        if (userId != null) {
            userRepository.deleteById(userId);
        }
        if (token != null) {
            pushTokenRepository.findByToken(token).ifPresent(pushTokenRepository::delete);
        }
    }

    private void stubResolve() {
        when(userLookupService.resolve(any()))
                .thenAnswer(inv -> new UserProfile(inv.getArgument(0), "User " + inv.getArgument(0), null));
    }

    private CreateChallengeRequest requestWithReminder(String name, String reminderTime) {
        return new CreateChallengeRequest(
                name, "Do it every day", 5, LocalDate.now(ZoneOffset.UTC).toString(), null, "PRIVATE",
                null, null, null, null, null, null, reminderTime);
    }

    @Test
    void sendsReminder_whenReminderTimeMatchesParticipantsLocalTime() {
        stubResolve();
        userId = "challenge-reminder-test-user-1";
        ZoneId zone = ZoneId.of("America/New_York");
        userRepository.save(new User(userId, zone.getId()));

        token = "ExponentPushToken[challenge-reminder-1]";
        pushTokenRepository.save(new PushToken(userId, token, "ios"));

        Instant now = ZonedDateTime.now(zone).withHour(7).withMinute(30).withSecond(0).withNano(0).toInstant();
        LocalTime reminderTime = now.atZone(zone).toLocalTime();

        challengeId = challengeService.create(
                userId, requestWithReminder("Morning Routine", reminderTime.toString().substring(0, 5)),
                zone.getId()).id();

        challengeReminderScheduler.sendDueReminders(now);

        ArgumentCaptor<List<ExpoPushMessage>> captor = ArgumentCaptor.forClass(List.class);
        verify(expoPushService).send(captor.capture());
        assertThat(captor.getValue()).hasSize(1);
        assertThat(captor.getValue().get(0).to()).isEqualTo(token);
        assertThat(captor.getValue().get(0).title()).contains("Morning Routine");
    }

    @Test
    void skipsReminder_whenTimeDoesNotMatch() {
        stubResolve();
        userId = "challenge-reminder-test-user-2";
        ZoneId zone = ZoneId.of("America/New_York");
        userRepository.save(new User(userId, zone.getId()));

        token = "ExponentPushToken[challenge-reminder-2]";
        pushTokenRepository.save(new PushToken(userId, token, "ios"));

        challengeId = challengeService.create(userId, requestWithReminder("Evening Read", "21:00"), zone.getId()).id();

        Instant notScheduledTime = ZonedDateTime.now(zone).withHour(9).withMinute(0).withSecond(0).withNano(0)
                .toInstant();
        challengeReminderScheduler.sendDueReminders(notScheduledTime);

        verify(expoPushService, never()).send(anyList());
    }

    @Test
    void skipsReminder_whenParticipantHasNoRecordedTimezone() {
        stubResolve();
        userId = "challenge-reminder-test-user-3";
        // Deliberately not saving a User row — no known timezone yet.

        token = "ExponentPushToken[challenge-reminder-3]";
        pushTokenRepository.save(new PushToken(userId, token, "ios"));

        challengeId = challengeService.create(userId, requestWithReminder("Stretch", "08:00"), "UTC").id();

        challengeReminderScheduler.sendDueReminders(Instant.now());

        verify(expoPushService, never()).send(anyList());
    }
}
