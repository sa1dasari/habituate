package com.habituate.api.groups;

import com.habituate.api.notifications.ExpoPushMessage;
import com.habituate.api.notifications.ExpoPushService;
import com.habituate.api.notifications.PushToken;
import com.habituate.api.notifications.PushTokenRepository;
import com.habituate.api.users.User;
import com.habituate.api.users.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Mirrors notifications.ReminderScheduler exactly, but for a Challenge's
 * reminderTime rather than a Habit's scheduledTime — every active
 * participant gets the nudge, not just the creator, matching the "Reminder/
 * Notification Window" field on Challenge creation.
 */
@Component
public class ChallengeReminderScheduler {

    private static final Logger log = LoggerFactory.getLogger(ChallengeReminderScheduler.class);

    private final ChallengeRepository challengeRepository;
    private final ChallengeParticipantRepository participantRepository;
    private final UserRepository userRepository;
    private final PushTokenRepository pushTokenRepository;
    private final ExpoPushService expoPushService;

    public ChallengeReminderScheduler(
            ChallengeRepository challengeRepository,
            ChallengeParticipantRepository participantRepository,
            UserRepository userRepository,
            PushTokenRepository pushTokenRepository,
            ExpoPushService expoPushService) {
        this.challengeRepository = challengeRepository;
        this.participantRepository = participantRepository;
        this.userRepository = userRepository;
        this.pushTokenRepository = pushTokenRepository;
        this.expoPushService = expoPushService;
    }

    @Scheduled(cron = "0 * * * * *")
    public void sweep() {
        sendDueReminders(Instant.now());
    }

    /** Public so a test can drive it with a fixed Instant instead of waiting on the cron/clock. */
    public void sendDueReminders(Instant now) {
        List<Challenge> candidates = challengeRepository.findWithActiveReminder(LocalDate.now(ZoneOffset.UTC));
        if (candidates.isEmpty()) {
            return;
        }

        List<ExpoPushMessage> messages = new ArrayList<>();
        for (Challenge challenge : candidates) {
            for (ChallengeParticipant participant : participantRepository.findByChallengeId(challenge.getId())) {
                ZoneId zone = resolveZone(participant.getUserId());
                if (zone == null) {
                    continue;
                }
                LocalTime nowLocal = now.atZone(zone).toLocalTime().truncatedTo(ChronoUnit.MINUTES);
                if (!nowLocal.equals(challenge.getReminderTime().truncatedTo(ChronoUnit.MINUTES))) {
                    continue;
                }
                List<PushToken> tokens = pushTokenRepository.findByUserId(participant.getUserId());
                for (PushToken token : tokens) {
                    messages.add(new ExpoPushMessage(
                            token.getToken(),
                            "Time for " + challenge.getName(),
                            "A gentle nudge from Habituate — whenever you're ready.",
                            Map.of("challengeId", challenge.getId())));
                }
            }
        }

        if (!messages.isEmpty()) {
            log.info("Sending {} challenge reminder(s)", messages.size());
            expoPushService.send(messages);
        }
    }

    private ZoneId resolveZone(String userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null || user.getTimezone() == null) {
            return null;
        }
        try {
            return ZoneId.of(user.getTimezone());
        } catch (DateTimeException e) {
            return null;
        }
    }
}
