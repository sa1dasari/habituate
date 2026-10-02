package com.habituate.api.groups;

import com.habituate.api.config.FirebaseAuthFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
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
    public List<ChallengeResponse> listMine(HttpServletRequest req) {
        return challengeService.listMine(userId(req));
    }

    @GetMapping("/browse")
    public List<ChallengeResponse> browse(HttpServletRequest req) {
        return challengeService.browse(userId(req));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ChallengeResponse create(HttpServletRequest req, @RequestBody CreateChallengeRequest request) {
        return challengeService.create(userId(req), request);
    }

    @PostMapping("/{challengeId}/join")
    public ChallengeResponse join(HttpServletRequest req, @PathVariable Long challengeId) {
        return challengeService.join(userId(req), challengeId);
    }

    @PostMapping("/{challengeId}/progress")
    public ChallengeResponse adjustProgress(
            HttpServletRequest req, @PathVariable Long challengeId, @RequestBody ChallengeProgressRequest request) {
        return challengeService.adjustProgress(userId(req), challengeId, request);
    }
}
