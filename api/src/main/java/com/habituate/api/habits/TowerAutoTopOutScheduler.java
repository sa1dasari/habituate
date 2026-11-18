package com.habituate.api.habits;

import com.habituate.api.users.User;
import com.habituate.api.users.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.DateTimeException;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;

/**
 * Tops towers out on their own once they reach their cap (SKYLINE.md section
 * 6). Runs hourly, and once at startup as a catch-up (after the one-time cap
 * clamp), so a tower is closed within about an hour of its owner's local
 * midnight rather than when they next open the app. Each habit is judged in
 * its owner's stored timezone (UTC when there is none), the same convention
 * as ReminderScheduler. All the rules live in HabitService.autoTopOutIfDue /
 * TowerCap; this class only iterates and isolates failures so one bad habit
 * cannot stop the sweep.
 */
@Component
public class TowerAutoTopOutScheduler {

    private static final Logger log = LoggerFactory.getLogger(TowerAutoTopOutScheduler.class);

    private final HabitRepository habitRepository;
    private final UserRepository userRepository;
    private final HabitService habitService;

    public TowerAutoTopOutScheduler(
            HabitRepository habitRepository,
            UserRepository userRepository,
            HabitService habitService) {
        this.habitRepository = habitRepository;
        this.userRepository = userRepository;
        this.habitService = habitService;
    }

    /** Caps above the new maximum are clamped once, then overdue towers are caught up. */
    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        try {
            int clamped = habitService.clampTopOutCaps();
            log.info("Tower cap clamp: {} habit(s) changed to the 35-day maximum", clamped);
        } catch (Exception e) {
            log.warn("Tower cap clamp failed: {}", e.getMessage());
        }
        sweep();
    }

    @Scheduled(cron = "0 5 * * * *")
    public void sweep() {
        Instant now = Instant.now();
        Map<String, ZoneId> zones = new HashMap<>();
        int toppedOut = 0;
        for (Habit habit : habitRepository.findAll()) {
            if (habit.isArchived()) {
                continue;
            }
            try {
                ZoneId zone = zones.computeIfAbsent(habit.getUserId(), this::resolveZone);
                if (habitService.autoTopOutIfDue(habit, zone, now)) {
                    toppedOut += 1;
                }
            } catch (Exception e) {
                log.warn("Automatic top-out failed for habit {}: {}", habit.getId(), e.getMessage());
            }
        }
        if (toppedOut > 0) {
            log.info("Automatic top-out: {} tower(s) reached their cap", toppedOut);
        }
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
