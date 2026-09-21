package com.habituate.api.goals;

import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;

@Service
public class GoalService {

    private final GoalRepository goalRepository;

    public GoalService(GoalRepository goalRepository) {
        this.goalRepository = goalRepository;
    }

    public List<GoalResponse> listGoals(String userId) {
        return goalRepository.findByUserIdAndArchivedFalseOrderByCreatedAtDesc(userId)
                .stream()
                .map(GoalResponse::from)
                .toList();
    }

    public List<GoalResponse> listArchivedGoals(String userId) {
        return goalRepository.findByUserIdAndArchivedTrueOrderByUpdatedAtDesc(userId)
                .stream()
                .map(GoalResponse::from)
                .toList();
    }

    public GoalResponse createGoal(String userId, CreateGoalRequest request) {
        String description = request.description() == null ? "" : request.description().trim();
        String period = normalizePeriod(request.period());
        Integer targetCount = request.targetCount() == null || request.targetCount() < 1 ? 1 : request.targetCount();
        LocalDate periodStart = parsePeriodStart(request.periodStart());

        Goal goal = new Goal(userId, description, period, targetCount, periodStart);
        return GoalResponse.from(goalRepository.save(goal));
    }

    public GoalResponse updateGoal(String userId, Long goalId, UpdateGoalRequest request) {
        Goal goal = requireOwnedGoal(userId, goalId);

        if (request.description() != null && !request.description().isBlank()) {
            goal.setDescription(request.description().trim());
        }
        if (request.targetCount() != null && request.targetCount() >= 1) {
            goal.setTargetCount(request.targetCount());
        }
        if (request.archived() != null) {
            goal.setArchived(request.archived());
        }

        return GoalResponse.from(goalRepository.save(goal));
    }

    /** Adjusts currentCount by delta (+1 / -1 from the stepper), clamped to >= 0. */
    public GoalResponse adjustProgress(String userId, Long goalId, GoalProgressRequest request) {
        Goal goal = requireOwnedGoal(userId, goalId);
        int delta = request.delta() == null ? 0 : request.delta();
        goal.setCurrentCount(Math.max(0, goal.getCurrentCount() + delta));
        return GoalResponse.from(goalRepository.save(goal));
    }

    /**
     * Starts a fresh period with the same description/target: resets
     * currentCount to 0 and advances periodStart. The old period's
     * count/target were already visible in the review the client showed
     * before calling this, so nothing needs to be snapshotted here.
     */
    public GoalResponse rollover(String userId, Long goalId, GoalRolloverRequest request) {
        Goal goal = requireOwnedGoal(userId, goalId);
        goal.setPeriodStart(parsePeriodStart(request.periodStart()));
        goal.setCurrentCount(0);
        return GoalResponse.from(goalRepository.save(goal));
    }

    public void deleteGoal(String userId, Long goalId) {
        Goal goal = requireOwnedGoal(userId, goalId);
        goalRepository.delete(goal);
    }

    private Goal requireOwnedGoal(String userId, Long goalId) {
        Goal goal = goalRepository.findById(goalId)
                .orElseThrow(() -> new EntityNotFoundException("Goal not found: " + goalId));

        if (!userId.equals(goal.getUserId())) {
            throw new IllegalArgumentException("Goal does not belong to user: " + userId);
        }

        return goal;
    }

    private String normalizePeriod(String value) {
        String upper = value == null ? "" : value.trim().toUpperCase();
        return upper.equals("MONTHLY") ? "MONTHLY" : "WEEKLY";
    }

    private LocalDate parsePeriodStart(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("periodStart is required");
        }
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException("Invalid periodStart, expected YYYY-MM-DD: " + value);
        }
    }
}
