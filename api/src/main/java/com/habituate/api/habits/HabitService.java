package com.habituate.api.habits;

import com.habituate.api.checkins.CheckIn;
import com.habituate.api.checkins.CheckInRepository;
import com.habituate.api.checkins.CheckInRequest;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class HabitService {

    private final HabitRepository habitRepository;
    private final CheckInRepository checkInRepository;

    public HabitService(HabitRepository habitRepository, CheckInRepository checkInRepository) {
        this.habitRepository = habitRepository;
        this.checkInRepository = checkInRepository;
    }

    public List<Habit> listHabits(String userId) {
        return habitRepository.findByUserIdAndArchivedFalseOrderByCreatedAtDesc(userId);
    }

    public Habit createHabit(String userId, CreateHabitRequest request) {
        String name = request.name() == null ? "" : request.name().trim();
        String category = request.category() == null ? "General" : request.category().trim();
        String cadenceType = request.cadenceType() == null ? "DAILY" : request.cadenceType().trim().toUpperCase();
        Integer cadenceTarget = request.cadenceTarget() == null ? 1 : request.cadenceTarget();

        Habit habit = new Habit(userId, name, category, cadenceType, cadenceTarget);
        return habitRepository.save(habit);
    }

    public Habit updateHabit(String userId, Long habitId, UpdateHabitRequest request) {
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
        if (request.archived() != null) {
            habit.setArchived(request.archived());
        }

        return habitRepository.save(habit);
    }

    public Habit archiveHabit(String userId, Long habitId) {
        Habit habit = habitRepository.findById(habitId)
                .orElseThrow(() -> new EntityNotFoundException("Habit not found: " + habitId));

        if (!userId.equals(habit.getUserId())) {
            throw new IllegalArgumentException("Habit does not belong to user: " + userId);
        }

        habit.setArchived(true);
        return habitRepository.save(habit);
    }

    public List<CheckIn> listCheckIns(String userId, Long habitId) {
        return checkInRepository.findByUserIdAndHabitIdOrderByOccurredAtDesc(userId, habitId);
    }

    public CheckIn createCheckIn(String userId, Long habitId, CheckInRequest request) {
        Habit habit = habitRepository.findById(habitId)
                .orElseThrow(() -> new EntityNotFoundException("Habit not found: " + habitId));

        if (!userId.equals(habit.getUserId())) {
            throw new IllegalArgumentException("Habit does not belong to user: " + userId);
        }

        CheckIn checkIn = new CheckIn(
                habitId,
                userId,
                request.occurredAt() != null ? request.occurredAt() : Instant.now(),
                request.value() != null ? request.value() : 1,
                request.source() != null ? request.source() : "manual"
        );

        return checkInRepository.save(checkIn);
    }

    public void deleteCheckIn(String userId, Long checkInId) {
        CheckIn checkIn = checkInRepository.findById(checkInId)
                .orElseThrow(() -> new EntityNotFoundException("Check-in not found: " + checkInId));

        if (!userId.equals(checkIn.getUserId())) {
            throw new IllegalArgumentException("Check-in does not belong to user: " + userId);
        }

        checkInRepository.delete(checkIn);
    }
}
