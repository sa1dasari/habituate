package com.habituate.api.notifications;

import com.habituate.api.checkins.CheckIn;
import com.habituate.api.checkins.CheckInRepository;
import com.habituate.api.habits.Habit;
import com.habituate.api.habits.HabitRepository;
import com.habituate.api.habits.StreakCalculator;
import com.habituate.api.users.User;
import com.habituate.api.users.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Runs every minute and fires a reminder for any habit whose scheduledTime
 * matches "now" in its owner's stored timezone (see users.User — the only
 * reason that table exists). A habit whose owner has no recorded timezone
 * yet is silently skipped rather than guessed at in UTC — better to miss a
 * reminder once than fire it at the wrong hour.
 */
@Component
public class ReminderScheduler {

    private static final Logger log = LoggerFactory.getLogger(ReminderScheduler.class);

    /** Below this, "you're on a streak" reads as a stretch rather than earned momentum. */
    private static final int STREAK_MENTION_THRESHOLD = 3;

    private final HabitRepository habitRepository;
    private final UserRepository userRepository;
    private final PushTokenRepository pushTokenRepository;
    private final ExpoPushService expoPushService;
    private final CheckInRepository checkInRepository;

    public ReminderScheduler(
            HabitRepository habitRepository,
            UserRepository userRepository,
            PushTokenRepository pushTokenRepository,
            ExpoPushService expoPushService,
            CheckInRepository checkInRepository) {
        this.habitRepository = habitRepository;
        this.userRepository = userRepository;
        this.pushTokenRepository = pushTokenRepository;
        this.expoPushService = expoPushService;
        this.checkInRepository = checkInRepository;
    }

    @Scheduled(cron = "0 * * * * *")
    public void sweep() {
        sendDueReminders(Instant.now());
    }

    /** Public so a test can drive it with a fixed Instant instead of waiting on the cron/clock. */
    public void sendDueReminders(Instant now) {
        List<Habit> candidates = habitRepository.findByReminderEnabledTrueAndArchivedFalseAndScheduledTimeIsNotNull();
        if (candidates.isEmpty()) {
            return;
        }

        Map<String, List<Habit>> byUser = candidates.stream().collect(Collectors.groupingBy(Habit::getUserId));
        List<ExpoPushMessage> messages = new ArrayList<>();

        for (Map.Entry<String, List<Habit>> entry : byUser.entrySet()) {
            String userId = entry.getKey();
            ZoneId zone = resolveZone(userId);
            if (zone == null) {
                continue;
            }

            List<PushToken> tokens = pushTokenRepository.findByUserId(userId);
            if (tokens.isEmpty()) {
                continue;
            }

            LocalTime nowLocal = now.atZone(zone).toLocalTime().truncatedTo(ChronoUnit.MINUTES);
            for (Habit habit : entry.getValue()) {
                if (!nowLocal.equals(habit.getScheduledTime().truncatedTo(ChronoUnit.MINUTES))) {
                    continue;
                }
                String body = reminderBody(habit, zone, now);
                for (PushToken token : tokens) {
                    messages.add(new ExpoPushMessage(
                            token.getToken(),
                            "Time for " + habit.getName(),
                            body,
                            Map.of("habitId", habit.getId())));
                }
            }
        }

        if (!messages.isEmpty()) {
            log.info("Sending {} habit reminder(s)", messages.size());
            expoPushService.send(messages);
        }
    }

    /**
     * Grounds the reminder in the habit's own real momentum instead of generic
     * boilerplate, when there's a genuine streak to point at — Duolingo's
     * documented finding is that a reminder referencing the user's actual
     * progress ("three lessons from B1 Spanish") outperforms a bare due-date
     * nudge. Framed as continuing positive momentum, never as loss-aversion
     * ("don't lose your streak") — that framing is exactly what CLAUDE.md's
     * anti-guilt rule rules out. Below STREAK_MENTION_THRESHOLD, or with no
     * streak at all, falls back to the original plain copy; frozen days are
     * deliberately not factored in here (unlike StreakCalculator's other
     * callers) since this is a one-line text, not something a user acts on.
     */
    private String reminderBody(Habit habit, ZoneId zone, Instant now) {
        List<CheckIn> checkIns = checkInRepository.findByUserIdAndHabitIdOrderByOccurredAtAsc(
                habit.getUserId(), habit.getId());
        int streak = StreakCalculator.compute(checkIns, zone, now).current();
        if (streak >= STREAK_MENTION_THRESHOLD) {
            return "You're on a " + streak + "-day streak — keep it going.";
        }
        return "A gentle nudge from Habituate — whenever you're ready.";
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
