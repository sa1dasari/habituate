package com.habituate.api.groups;

import com.habituate.api.config.FirebaseAuthFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/challenges")
public class ChallengeController {

    private final ChallengeService challengeService;

    public ChallengeController(ChallengeService challengeService) {
        this.challengeService = challengeService;
    }

    private String userId(HttpServletRequest req) {
        return (String) req.getAttribute(FirebaseAuthFilter.USER_ID_ATTRIBUTE);
    }

    @GetMapping
    public List<ChallengeResponse> listMine(
            HttpServletRequest req, @RequestHeader(value = "X-Timezone", required = false) String timezone) {
        return challengeService.listMine(userId(req), timezone);
    }

    @GetMapping("/browse")
    public List<ChallengeResponse> browse(
            HttpServletRequest req, @RequestHeader(value = "X-Timezone", required = false) String timezone) {
        return challengeService.browse(userId(req), timezone);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ChallengeResponse create(
            HttpServletRequest req,
            @RequestBody CreateChallengeRequest request,
            @RequestHeader(value = "X-Timezone", required = false) String timezone) {
        return challengeService.create(userId(req), request, timezone);
    }

    @PatchMapping("/{challengeId}")
    public ChallengeResponse update(
            HttpServletRequest req,
            @PathVariable Long challengeId,
            @RequestBody CreateChallengeRequest request,
            @RequestHeader(value = "X-Timezone", required = false) String timezone) {
        return challengeService.update(userId(req), challengeId, request, timezone);
    }

    @PostMapping("/{challengeId}/join")
    public ChallengeResponse join(
            HttpServletRequest req,
            @PathVariable Long challengeId,
            @RequestHeader(value = "X-Timezone", required = false) String timezone) {
        return challengeService.join(userId(req), challengeId, timezone);
    }

    @PostMapping("/{challengeId}/invite")
    public ChallengeResponse invite(
            HttpServletRequest req,
            @PathVariable Long challengeId,
            @RequestBody InviteToChallengeRequest request,
            @RequestHeader(value = "X-Timezone", required = false) String timezone) {
        return challengeService.invite(userId(req), challengeId, request.friendUserId(), timezone);
    }

    @PostMapping("/{challengeId}/check-ins")
    public ChallengeResponse logCheckIn(
            HttpServletRequest req,
            @PathVariable Long challengeId,
            @RequestBody(required = false) LogChallengeCheckInRequest request,
            @RequestHeader(value = "X-Timezone", required = false) String timezone) {
        Integer value = request == null ? null : request.value();
        return challengeService.logCheckIn(userId(req), challengeId, value, timezone);
    }

    @DeleteMapping("/{challengeId}/check-ins/today")
    public ChallengeResponse unlogCheckIn(
            HttpServletRequest req,
            @PathVariable Long challengeId,
            @RequestHeader(value = "X-Timezone", required = false) String timezone) {
        return challengeService.unlogCheckIn(userId(req), challengeId, timezone);
    }
}
