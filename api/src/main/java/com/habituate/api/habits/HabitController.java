package com.habituate.api.habits;

import com.habituate.api.checkins.CheckInRequest;
import com.habituate.api.checkins.CheckInResponse;
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
public class HabitController {

    private final HabitService habitService;

    public HabitController(HabitService habitService) {
        this.habitService = habitService;
    }

    /** Extracts the verified Firebase UID set by FirebaseAuthFilter. */
    private String userId(HttpServletRequest req) {
        return (String) req.getAttribute(FirebaseAuthFilter.USER_ID_ATTRIBUTE);
    }

    @GetMapping("/habits")
    public List<HabitResponse> listHabits(
            HttpServletRequest req,
            @RequestParam(defaultValue = "false") boolean archived) {

        String userId = userId(req);
        return archived
                ? habitService.listArchivedHabits(userId)
                : habitService.listHabits(userId);
    }

    @PostMapping("/habits")
    @ResponseStatus(HttpStatus.CREATED)
    public HabitResponse createHabit(HttpServletRequest req, @RequestBody CreateHabitRequest request) {
        return habitService.createHabit(userId(req), request);
    }

    @PutMapping("/habits/{habitId}")
    public HabitResponse updateHabit(
            HttpServletRequest req,
            @PathVariable Long habitId,
            @RequestBody UpdateHabitRequest request) {
        return habitService.updateHabit(userId(req), habitId, request);
    }

    /** Permanent — removes the habit and its check-ins. Archiving is PUT with {"archived": true}. */
    @DeleteMapping("/habits/{habitId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteHabit(HttpServletRequest req, @PathVariable Long habitId) {
        habitService.deleteHabit(userId(req), habitId);
    }

    @GetMapping("/habits/{habitId}/check-ins")
    public List<CheckInResponse> listCheckIns(HttpServletRequest req, @PathVariable Long habitId) {
        return habitService.listCheckIns(userId(req), habitId).stream()
                .map(CheckInResponse::from)
                .toList();
    }

    @PostMapping("/habits/{habitId}/check-ins")
    @ResponseStatus(HttpStatus.CREATED)
    public CheckInResponse createCheckIn(
            HttpServletRequest req,
            @PathVariable Long habitId,
            @RequestBody(required = false) CheckInRequest request) {

        CheckInRequest safeRequest = request == null ? new CheckInRequest(null, 1, "manual") : request;
        return CheckInResponse.from(habitService.createCheckIn(userId(req), habitId, safeRequest));
    }

    @DeleteMapping("/check-ins/{checkInId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCheckIn(HttpServletRequest req, @PathVariable Long checkInId) {
        habitService.deleteCheckIn(userId(req), checkInId);
    }
}
