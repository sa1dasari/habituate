package com.habituate.api.habits;

import com.habituate.api.checkins.CheckIn;
import com.habituate.api.checkins.CheckInRepository;
import com.habituate.api.checkins.CheckInRequest;
import com.habituate.api.common.DuplicateCheckInException;
import com.habituate.api.common.ForbiddenException;
import com.habituate.api.events.CheckInEventPublisher;
import com.habituate.api.groups.GroupMember;
import com.habituate.api.groups.GroupMemberRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.List;

@Service
public class HabitService {

    private final HabitRepository habitRepository;
    private final CheckInRepository checkInRepository;
    private final CheckInEventPublisher checkInEventPublisher;
    private final GroupMemberRepository groupMemberRepository;

    public HabitService(
            HabitRepository habitRepository,
            CheckInRepository checkInRepository,
            CheckInEventPublisher checkInEventPublisher,
            GroupMemberRepository groupMemberRepository) {
        this.habitRepository = habitRepository;
        this.checkInRepository = checkInRepository;
        this.checkInEventPublisher = checkInEventPublisher;
        this.groupMemberRepository = groupMemberRepository;
    }

    public List<HabitResponse> listHabits(String userId, String timezone) {
        ZoneId zone = resolveZone(timezone);
        return habitRepository.findByUserIdAndArchivedFalseOrderByCreatedAtDesc(userId)
                .stream()
                .map(habit -> toResponse(habit, zone))
                .toList();
    }

    public List<HabitResponse> listArchivedHabits(String userId, String timezone) {
        ZoneId zone = resolveZone(timezone);
        return habitRepository.findByUserIdAndArchivedTrueOrderByUpdatedAtDesc(userId)
                .stream()
                .map(habit -> toResponse(habit, zone))
                .toList();
    }

    /** Falls back to UTC when the client sends no zone or an unparseable one. */
    private ZoneId resolveZone(String timezone) {
        if (timezone == null || timezone.isBlank()) {
            return ZoneOffset.UTC;
        }
        try {
            return ZoneId.of(timezone.trim());
        } catch (DateTimeException ex) {
            return ZoneOffset.UTC;
        }
    }

    private HabitResponse toResponse(Habit habit, ZoneId zone) {
        List<CheckIn> checkIns = checkInRepository.findByUserIdAndHabitIdOrderByOccurredAtAsc(
                habit.getUserId(), habit.getId());
        StreakCalculator.Streaks streaks = StreakCalculator.compute(checkIns, zone);
        return HabitResponse.from(habit, streaks.current(), streaks.longest());
    }

    private HabitResponse toResponse(Habit habit) {
        return toResponse(habit, ZoneOffset.UTC);
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
            throw new ForbiddenException("Habit does not belong to user: " + userId);
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
            throw new ForbiddenException("Habit does not belong to user: " + userId);
        }

        return habit;
    }

    public List<CheckIn> listCheckIns(String userId, Long habitId) {
        return checkInRepository.findByUserIdAndHabitIdOrderByOccurredAtDesc(userId, habitId);
    }

    // Self-invocation note: this delegates to the @Transactional overload
    // below, but Spring's @Transactional only applies through the proxy, not
    // on an internal this.method() call — so this overload needs its own
    // @Transactional too, or a caller entering through here wouldn't get a
    // transaction at all (the Kafka-failure rollback test would silently pass
    // without ever exercising a rollback).
    @Transactional
    public CheckIn createCheckIn(String userId, Long habitId, CheckInRequest request) {
        return createCheckIn(userId, habitId, request, null);
    }

    @Transactional
    public CheckIn createCheckIn(String userId, Long habitId, CheckInRequest request, String timezone) {
        Habit habit = habitRepository.findById(habitId)
                .orElseThrow(() -> new EntityNotFoundException("Habit not found: " + habitId));

        if (!userId.equals(habit.getUserId())) {
            throw new ForbiddenException("Habit does not belong to user: " + userId);
        }

        Instant occurredAt = request.occurredAt() != null ? request.occurredAt() : Instant.now();

        // Backdating is allowed (as far back as the habit itself existing),
        // but a client-supplied occurredAt is still just client input — don't
        // trust it blindly. Bucketed in the client's own zone (falls back to
        // UTC if absent/invalid) so a day boundary here agrees with whatever
        // local day the mobile calendar showed the user when they tapped it —
        // a fixed "noon local" timestamp alone can't guarantee that for every
        // real-world UTC offset (e.g. UTC+13/+14 can still roll to the
        // adjacent UTC day), so the server needs to bucket in the same zone
        // the client is reasoning in, same as StreakCalculator.
        ZoneId zone = resolveZone(timezone);

        if (occurredAt.isAfter(Instant.now())) {
            throw new IllegalArgumentException("Cannot check in for a future date: " + occurredAt);
        }
        LocalDate occurredDay = occurredAt.atZone(zone).toLocalDate();
        LocalDate habitCreatedDay = habit.getCreatedAt().atZone(zone).toLocalDate();
        if (occurredDay.isBefore(habitCreatedDay)) {
            throw new IllegalArgumentException(
                    "Cannot check in before the habit was created (" + habitCreatedDay + "): " + occurredDay);
        }

        // BOOLEAN habits are a single toggle per day (see Habit.java) — COUNT
        // habits are allowed multiple check-ins a day by design, so only guard
        // the BOOLEAN case against duplicate taps/retries landing twice.
        if ("BOOLEAN".equals(habit.getTrackingMode())) {
            Instant dayStart = occurredDay.atStartOfDay(zone).toInstant();
            Instant dayEnd = occurredDay.plusDays(1).atStartOfDay(zone).toInstant();
            boolean alreadyCheckedIn = checkInRepository.existsByHabitIdAndOccurredAtBetween(habitId, dayStart, dayEnd);
            if (alreadyCheckedIn) {
                throw new DuplicateCheckInException("Habit " + habitId + " is already checked in for " + occurredDay);
            }
        }

        CheckIn checkIn = new CheckIn(
                habitId,
                userId,
                occurredAt,
                request.value() != null ? request.value() : 1,
                request.source() != null ? request.source() : "manual"
        );

        // If this habit is linked to a group (see groups.GroupMember), tag the
        // check-in so GroupStreakConsumer's checkin-events listener can filter
        // to it — per CLAUDE.md, a group is just a filtered consumer of the
        // same stream, not a separate check-in path.
        groupMemberRepository.findByHabitIdAndStatus(habitId, GroupMember.ACTIVE)
                .ifPresent(member -> checkIn.setGroupId(member.getGroupId()));

        CheckIn saved = checkInRepository.save(checkIn);
        checkInEventPublisher.publishCreated(saved);
        return saved;
    }

    @Transactional
    public void deleteCheckIn(String userId, Long checkInId) {
        CheckIn checkIn = checkInRepository.findById(checkInId)
                .orElseThrow(() -> new EntityNotFoundException("Check-in not found: " + checkInId));

        if (!userId.equals(checkIn.getUserId())) {
            throw new ForbiddenException("Check-in does not belong to user: " + userId);
        }

        checkInRepository.delete(checkIn);
        checkInEventPublisher.publishDeleted(checkIn);
    }
}
