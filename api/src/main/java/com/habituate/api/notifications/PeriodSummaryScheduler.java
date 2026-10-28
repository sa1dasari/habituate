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
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Fires account-wide recap notifications (WEEKLY_SUMMARY/MONTHLY_SUMMARY/
 * YEARLY_SUMMARY) for the period that just closed — a new category,
 * distinct from the client-only, per-habit "featured goal review" card
 * (useFeaturedGoalReviews.js) which nudges about one pinned habit's own
 * recurring target. This is a single backend-generated notification per
 * user per period, covering every habit at once, that persists in the
 * notification center and deep-links into Insights at that specific past
 * period (see AppNotification.periodStart).
 *
 * Follows the same shape as the other @Scheduled jobs in this codebase
 * (ReminderScheduler, PersonalStreakFreezeScheduler, StreakFreezeScheduler):
 * one sweep per period length, grouping habits by owner, best-effort via
 * AppNotificationService (a write failure here must never affect any other
 * part of the app).
 *
 * Zone handling deliberately differs from ReminderScheduler: a reminder
 * that fires at the wrong hour is a visible bug, so ReminderScheduler skips
 * a user with no recorded timezone entirely. A summary has no "wrong hour"
 * to get right — only which calendar days it buckets — so a missing
 * timezone falls back to UTC here instead of silently never sending a
 * recap to that user.
 */
@Component
public class PeriodSummaryScheduler {

    private static final Logger log = LoggerFactory.getLogger(PeriodSummaryScheduler.class);

    private final HabitRepository habitRepository;
    private final CheckInRepository checkInRepository;
    private final UserRepository userRepository;
    private final AppNotificationService notificationService;

    public PeriodSummaryScheduler(
            HabitRepository habitRepository,
            CheckInRepository checkInRepository,
            UserRepository userRepository,
            AppNotificationService notificationService) {
        this.habitRepository = habitRepository;
        this.checkInRepository = checkInRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }

    /** Mondays just after UTC midnight — the week that just closed is the previous Mon–Sun. */
    @Scheduled(cron = "0 10 0 * * MON")
    public void sweepWeekly() {
        sweep(AppNotification.WEEKLY_SUMMARY, (zone, today) -> {
            LocalDate thisMonday = today.minusDays((today.getDayOfWeek().getValue() - 1));
            LocalDate start = thisMonday.minusWeeks(1);
            return new LocalDate[]{start, thisMonday};
        });
    }

    /** The 1st of the month just after UTC midnight — the month that just closed. */
    @Scheduled(cron = "0 15 0 1 * *")
    public void sweepMonthly() {
        sweep(AppNotification.MONTHLY_SUMMARY, (zone, today) -> {
            LocalDate firstOfThisMonth = today.withDayOfMonth(1);
            LocalDate firstOfLastMonth = firstOfThisMonth.minusMonths(1);
            return new LocalDate[]{firstOfLastMonth, firstOfThisMonth};
        });
    }

    /** January 1st just after UTC midnight — the year that just closed. */
    @Scheduled(cron = "0 20 0 1 1 *")
    public void sweepYearly() {
        sweep(AppNotification.YEARLY_SUMMARY, (zone, today) -> {
            LocalDate firstOfThisYear = today.withDayOfYear(1);
            LocalDate firstOfLastYear = firstOfThisYear.minusYears(1);
            return new LocalDate[]{firstOfLastYear, firstOfThisYear};
        });
    }

    private interface PeriodWindow {
        LocalDate[] resolve(ZoneId zone, LocalDate today);
    }

    /** Public (package-visible via the functional interface) so a test can drive one sweep
     * with a fixed window instead of waiting on the cron. */
    void sweep(String type, PeriodWindow window) {
        List<Habit> allHabits = habitRepository.findAll().stream()
                .filter(h -> !h.isArchived())
                .toList();
        if (allHabits.isEmpty()) {
            return;
        }
        Map<String, List<Habit>> byUser = allHabits.stream().collect(Collectors.groupingBy(Habit::getUserId));

        int sent = 0;
        for (Map.Entry<String, List<Habit>> entry : byUser.entrySet()) {
            String userId = entry.getKey();
            ZoneId zone = resolveZone(userId);
            LocalDate today = Instant.now().atZone(zone).toLocalDate();
            LocalDate[] range = window.resolve(zone, today);
            LocalDate start = range[0];
            LocalDate endExclusive = range[1];

            PeriodStats stats = computeStats(entry.getValue(), userId, zone, start, endExclusive);
            if (stats == null) {
                continue; // no habit existed yet during this period — nothing to recap
            }

            Instant periodStartInstant = start.atStartOfDay(zone).toInstant();
            String[] copy = buildCopy(type, stats);
            notificationService.notifyPeriodSummary(userId, type, copy[0], copy[1], periodStartInstant);
            sent++;
        }
        log.info("Period summary sweep ({}) sent {} notification(s)", type, sent);
    }

    private record PeriodStats(int activeDays, int possibleDays, int totalCheckIns, String bestHabitName, int bestStreak) {
        int percent() {
            return possibleDays == 0 ? 0 : Math.round((activeDays * 100f) / possibleDays);
        }
    }

    private PeriodStats computeStats(List<Habit> habits, String userId, ZoneId zone, LocalDate start, LocalDate endExclusive) {
        List<CheckIn> allCheckIns = checkInRepository.findByUserId(userId);

        Set<LocalDate> activeDays = new HashSet<>();
        int totalCheckIns = 0;
        for (CheckIn c : allCheckIns) {
            LocalDate day = c.getOccurredAt().atZone(zone).toLocalDate();
            if (!day.isBefore(start) && day.isBefore(endExclusive)) {
                totalCheckIns++;
                if (c.getValue() == null || c.getValue() > 0) {
                    activeDays.add(day);
                }
            }
        }

        int possibleDays = 0;
        for (LocalDate day = start; day.isBefore(endExclusive); day = day.plusDays(1)) {
            LocalDate d = day;
            boolean anyHabitExisted = habits.stream()
                    .anyMatch(h -> !h.getCreatedAt().atZone(zone).toLocalDate().isAfter(d));
            if (anyHabitExisted) possibleDays++;
        }
        if (possibleDays == 0) {
            return null;
        }

        String bestHabitName = null;
        double bestRatio = -1;
        int bestStreak = 0;
        Instant periodEnd = endExclusive.atStartOfDay(zone).toInstant();
        for (Habit habit : habits) {
            LocalDate habitCreated = habit.getCreatedAt().atZone(zone).toLocalDate();
            if (habitCreated.isAfter(endExclusive.minusDays(1))) continue;

            List<CheckIn> habitCheckIns = allCheckIns.stream()
                    .filter(c -> c.getHabitId().equals(habit.getId()))
                    .toList();

            int existedDays = 0;
            Set<LocalDate> doneDays = new HashSet<>();
            for (LocalDate day = start; day.isBefore(endExclusive); day = day.plusDays(1)) {
                if (day.isBefore(habitCreated)) continue;
                existedDays++;
            }
            for (CheckIn c : habitCheckIns) {
                LocalDate day = c.getOccurredAt().atZone(zone).toLocalDate();
                if (!day.isBefore(start) && day.isBefore(endExclusive) && (c.getValue() == null || c.getValue() > 0)) {
                    doneDays.add(day);
                }
            }
            if (existedDays < 3) continue; // too little history this period to call it an MVP
            double ratio = (double) doneDays.size() / existedDays;
            if (ratio > bestRatio) {
                bestRatio = ratio;
                bestHabitName = habit.getName();
                bestStreak = StreakCalculator.compute(habitCheckIns, zone, periodEnd).current();
            }
        }

        return new PeriodStats(activeDays.size(), possibleDays, totalCheckIns, bestHabitName, bestStreak);
    }

    /** Engaging, non-corporate, data-grounded recap copy — matches the anti-guilt, trend-framing
     * voice this app's other copy uses (CLAUDE.md): never a verdict, never shaming, always "here's
     * what actually happened" rather than "X causes Y". @return {title, body}. */
    private String[] buildCopy(String type, PeriodStats stats) {
        int percent = stats.percent();
        String periodWord = switch (type) {
            case AppNotification.WEEKLY_SUMMARY -> "week";
            case AppNotification.MONTHLY_SUMMARY -> "month";
            default -> "year";
        };
        String title = switch (type) {
            case AppNotification.WEEKLY_SUMMARY -> "Your week, wrapped";
            case AppNotification.MONTHLY_SUMMARY -> "Your month in review";
            default -> "Your year, by the numbers";
        };

        StringBuilder body = new StringBuilder();
        body.append("You showed up on ").append(stats.activeDays()).append(" of ")
                .append(stats.possibleDays()).append(" days this ").append(periodWord)
                .append(" (").append(percent).append("%) — ").append(stats.totalCheckIns())
                .append(stats.totalCheckIns() == 1 ? " check-in logged." : " check-ins logged.");

        if (stats.bestHabitName() != null) {
            body.append(" ").append(stats.bestHabitName()).append(" was your MVP");
            if (stats.bestStreak() > 1) {
                body.append(" — riding a ").append(stats.bestStreak()).append("-day streak");
            }
            body.append(".");
        }

        if (percent >= 80) {
            body.append(" That's a rhythm worth protecting. Tap to see the full breakdown.");
        } else if (percent >= 40) {
            body.append(" Real momentum building — tap to see the full breakdown.");
        } else {
            body.append(" Every logged day still counts toward the pattern. Tap to see the full breakdown.");
        }

        return new String[]{title, body.toString()};
    }

    private ZoneId resolveZone(String userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null || user.getTimezone() == null) {
            return ZoneOffset.UTC;
        }
        try {
            return ZoneId.of(user.getTimezone());
        } catch (DateTimeException e) {
            return ZoneOffset.UTC;
        }
    }
}
