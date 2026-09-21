package com.habituate.api.goals;

import com.habituate.api.config.FirebaseAuthFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
public class GoalController {

    private final GoalService goalService;

    public GoalController(GoalService goalService) {
        this.goalService = goalService;
    }

    private String userId(HttpServletRequest req) {
        return (String) req.getAttribute(FirebaseAuthFilter.USER_ID_ATTRIBUTE);
    }

    @GetMapping("/goals")
    public List<GoalResponse> listGoals(HttpServletRequest req, @RequestParam(defaultValue = "false") boolean archived) {
        String userId = userId(req);
        return archived ? goalService.listArchivedGoals(userId) : goalService.listGoals(userId);
    }

    @PostMapping("/goals")
    @ResponseStatus(HttpStatus.CREATED)
    public GoalResponse createGoal(HttpServletRequest req, @RequestBody CreateGoalRequest request) {
        return goalService.createGoal(userId(req), request);
    }

    @PutMapping("/goals/{goalId}")
    public GoalResponse updateGoal(HttpServletRequest req, @PathVariable Long goalId, @RequestBody UpdateGoalRequest request) {
        return goalService.updateGoal(userId(req), goalId, request);
    }

    @PostMapping("/goals/{goalId}/progress")
    public GoalResponse adjustProgress(HttpServletRequest req, @PathVariable Long goalId, @RequestBody GoalProgressRequest request) {
        return goalService.adjustProgress(userId(req), goalId, request);
    }

    @PostMapping("/goals/{goalId}/rollover")
    public GoalResponse rollover(HttpServletRequest req, @PathVariable Long goalId, @RequestBody GoalRolloverRequest request) {
        return goalService.rollover(userId(req), goalId, request);
    }

    @DeleteMapping("/goals/{goalId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteGoal(HttpServletRequest req, @PathVariable Long goalId) {
        goalService.deleteGoal(userId(req), goalId);
    }
}
