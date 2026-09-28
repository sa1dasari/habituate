package com.habituate.api.habits;

import com.habituate.api.checkins.CheckIn;
import com.habituate.api.checkins.CheckInRepository;
import com.habituate.api.checkins.CheckInRequest;
import com.habituate.api.events.CheckInEventPublisher;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
public class HabitService {

    private final HabitRepository habitRepository;
    private final CheckInRepository checkInRepository;
    private final CheckInEventPublisher checkInEventPublisher;

    public HabitService(
            HabitRepository habitRepository,
            CheckInRepository checkInRepository,
            CheckInEventPublisher checkInEventPublisher) {
        this.habitRepository = habitRepository;
        this.checkInRepository = checkInRepository;
        this.checkInEventPublisher = checkInEventPublisher;
    }

    public List<HabitResponse> listHabits(String userId) {
        return habitRepository.findByUserIdAndArchivedFalseOrderByCreatedAtDesc(userId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public List<HabitResponse> listArchivedHabits(String userId) {
        return habitRepository.findByUserIdAndArchivedTrueOrderByUpdatedAtDesc(userId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private HabitResponse toResponse(Habit habit) {
        List<CheckIn> checkIns = checkInRepository.findByUserIdAndHabitIdOrderByOccurredAtAsc(
                habit.getUserId(), habit.getId());
        StreakCalculator.Streaks streaks = StreakCalculator.compute(checkIns);
        return HabitResponse.from(habit, streaks.current(), streaks.longest());
    }

    public HabitResponse createHabit(String userId, CreateHabitRequest request) {
        String name = request.name() == null ? "" : request.name().trim();
        String category = request.category() == null ? "General" : request.category().trim();
        String cadenceType = request.cadenceType() == null ? "DAILY" : request.cadenceType().trim().toUpperCase();
        Integer cadenceTarget = request.cadenceTarget() == null ? 1 : request.cadenceTarget();

        Habit habit = new Habit(userId, name, category, cadenceType, cadenceTarget);
        habit.setWeeklyTarget(request.weeklyTarget());
        habit.setMonthlyTarget(request.monthlyTarget());
        habit.setTrackingMode(normalizeTrackingMode(request.trackingMode()));
        habit.setFeaturedGoal(Boolean.TRUE.equals(request.featuredGoal()));
        habit.setScheduledTime(parseScheduledTime(request.scheduledTime()));
        habit.setReminderEnabled(
                Boolean.TRUE.equals(request.reminderEnabled()) && habit.getScheduledTime() != null
        );
        return toResponse(habitRepository.save(habit));
    }

    public HabitResponse updateHabit(String userId, Long habitId, UpdateHabitRequest request) {
        Habit habit = habitRepository.findById(habitId)
                .orElseThrow(() -> new EntityNotFoundException("Habit not found: " + habitId));

        if (!userId.equals(habit.getUserId())) {
            throw new IllegalArgumentException("Habit does not belong to user: " + userId);
        }

        if (request.name() != null && !request.name().isBlank()) {
            habit.setName(request.name().trim());
        }
        if (request.category() != null && !request.category().isBlank()) {
            habit.setCategory(request.category().trim());
        }
        if (request.cadenceType() != null && !request.cadenceType().isBlank()) {
            habit.setCadenceType(request.cadenceType().trim().toUpperCase());
        }
        if (request.cadenceTarget() != null) {
            habit.setCadenceTarget(request.cadenceTarget());
        }
        // A blank scheduledTime clears it, so the time can be removed after being set.
        if (request.scheduledTime() != null) {
            habit.setScheduledTime(parseScheduledTime(request.scheduledTime()));
        }
        if (request.reminderEnabled() != null) {
            habit.setReminderEnabled(request.reminderEnabled());
        }
        if (habit.getScheduledTime() == null) {
            habit.setReminderEnabled(false);
        }
        // weeklyTarget / monthlyTarget: null means "clear it", so always apply when key is present.
        // Since records always include the field, we apply unconditionally (null clears the target).
        habit.setWeeklyTarget(request.weeklyTarget());
        habit.setMonthlyTarget(request.monthlyTarget());

        if (request.trackingMode() != null) {
            habit.setTrackingMode(normalizeTrackingMode(request.trackingMode()));
        }
        if (request.featuredGoal() != null) {
            habit.setFeaturedGoal(request.featuredGoal());
        }

        if (request.archived() != null) {
            habit.setArchived(request.archived());
        }

        return toResponse(habitRepository.save(habit));
    }

    private String normalizeTrackingMode(String value) {
        if (value == null) return "BOOLEAN";
        String upper = value.trim().toUpperCase();
        return upper.equals("COUNT") ? "COUNT" : "BOOLEAN";
    }

    /** Accepts "HH:mm" or "HH:mm:ss"; blank clears the time. */
    private LocalTime parseScheduledTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalTime.parse(value.trim());
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException("Invalid scheduledTime, expected HH:mm: " + value);
        }
    }

    public HabitResponse setArchived(String userId, Long habitId, boolean archived) {
        Habit habit = requireOwnedHabit(userId, habitId);
        habit.setArchived(archived);
        return toResponse(habitRepository.save(habit));
    }

    /**
     * Hard delete. Archiving is the reversible option; this one is not, so the
     * habit's check-in history goes with it rather than being orphaned.
     */
    @Transactional
    public void deleteHabit(String userId, Long habitId) {
        Habit habit = requireOwnedHabit(userId, habitId);
        checkInRepository.deleteByHabitId(habit.getId());
        habitRepository.delete(habit);
    }

    private Habit requireOwnedHabit(String userId, Long habitId) {
        Habit habit = habitRepository.findById(habitId)
                .orElseThrow(() -> new EntityNotFoundException("Habit not found: " + habitId));

        if (!userId.equals(habit.getUserId())) {
            throw new IllegalArgumentException("Habit does not belong to user: " + userId);
        }

        return habit;
    }

    public List<CheckIn> listCheckIns(String userId, Long habitId) {
        return checkInRepository.findByUserIdAndHabitIdOrderByOccurredAtDesc(userId, habitId);
    }

    @Transactional
    public CheckIn createCheckIn(String userId, Long habitId, CheckInRequest request) {
        Habit habit = habitRepository.findById(habitId)
                .orElseThrow(() -> new EntityNotFoundException("Habit not found: " + habitId));

        if (!userId.equals(habit.getUserId())) {
            throw new IllegalArgumentException("Habit does not belong to user: " + userId);
        }

        Instant occurredAt = request.occurredAt() != null ? request.occurredAt() : Instant.now();

        // BOOLEAN habits are a single toggle per day (see Habit.java) — COUNT
        // habits are allowed multiple check-ins a day by design, so only guard
        // the BOOLEAN case against duplicate taps/retries landing twice.
        if ("BOOLEAN".equals(habit.getTrackingMode())) {
            LocalDate day = occurredAt.atZone(ZoneOffset.UTC).toLocalDate();
            Instant dayStart = day.atStartOfDay(ZoneOffset.UTC).toInstant();
            Instant dayEnd = dayStart.plus(1, ChronoUnit.DAYS);
            boolean alreadyCheckedIn = checkInRepository.existsByHabitIdAndOccurredAtBetween(habitId, dayStart, dayEnd);
            if (alreadyCheckedIn) {
                throw new IllegalStateException("Habit " + habitId + " is already checked in for " + day);
            }
        }

        CheckIn checkIn = new CheckIn(
                habitId,
                userId,
                occurredAt,
                request.value() != null ? request.value() : 1,
                request.source() != null ? request.source() : "manual"
        );

        CheckIn saved = checkInRepository.save(checkIn);
        checkInEventPublisher.publishCreated(saved);
        return saved;
    }

    @Transactional
    public void deleteCheckIn(String userId, Long checkInId) {
        CheckIn checkIn = checkInRepository.findById(checkInId)
                .orElseThrow(() -> new EntityNotFoundException("Check-in not found: " + checkInId));

        if (!userId.equals(checkIn.getUserId())) {
            throw new IllegalArgumentException("Check-in does not belong to user: " + userId);
        }

        checkInRepository.delete(checkIn);
        checkInEventPublisher.publishDeleted(checkIn);
    }
}
