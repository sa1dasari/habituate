package com.habituate.api.habits;

import com.habituate.api.checkins.CheckInRequest;
import com.habituate.api.checkins.CheckInResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.CrossOrigin;
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
@CrossOrigin(origins = "*")
public class HabitController {

    private final HabitService habitService;

    public HabitController(HabitService habitService) {
        this.habitService = habitService;
    }

    @GetMapping("/habits")
    public List<HabitResponse> listHabits(@RequestParam(defaultValue = "demo-user") String userId) {
        return habitService.listHabits(userId).stream()
                .map(HabitResponse::from)
                .toList();
    }

    @PostMapping("/habits")
    @ResponseStatus(HttpStatus.CREATED)
    public HabitResponse createHabit(
            @RequestParam(defaultValue = "demo-user") String userId,
            @RequestBody CreateHabitRequest request) {
        return HabitResponse.from(habitService.createHabit(userId, request));
    }

    @PutMapping("/habits/{habitId}")
    public HabitResponse updateHabit(
            @RequestParam(defaultValue = "demo-user") String userId,
            @PathVariable Long habitId,
            @RequestBody UpdateHabitRequest request) {
        return HabitResponse.from(habitService.updateHabit(userId, habitId, request));
    }

    @DeleteMapping("/habits/{habitId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void archiveHabit(@RequestParam(defaultValue = "demo-user") String userId, @PathVariable Long habitId) {
        habitService.archiveHabit(userId, habitId);
    }

    @GetMapping("/habits/{habitId}/check-ins")
    public List<CheckInResponse> listCheckIns(
            @RequestParam(defaultValue = "demo-user") String userId,
            @PathVariable Long habitId) {
        return habitService.listCheckIns(userId, habitId).stream()
                .map(CheckInResponse::from)
                .toList();
    }

    @PostMapping("/habits/{habitId}/check-ins")
    @ResponseStatus(HttpStatus.CREATED)
    public CheckInResponse createCheckIn(
            @RequestParam(defaultValue = "demo-user") String userId,
            @PathVariable Long habitId,
            @RequestBody(required = false) CheckInRequest request) {

        CheckInRequest safeRequest = request == null ? new CheckInRequest(null, 1, "manual") : request;
        return CheckInResponse.from(habitService.createCheckIn(userId, habitId, safeRequest));
    }

    @DeleteMapping("/check-ins/{checkInId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCheckIn(@RequestParam(defaultValue = "demo-user") String userId, @PathVariable Long checkInId) {
        habitService.deleteCheckIn(userId, checkInId);
    }
}
