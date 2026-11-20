package com.habituate.api.groups;

import com.habituate.api.config.FirebaseAuthFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/challenges/{challengeId}/end-vote")
public class ChallengeVoteController {

    private final ChallengeEndVoteService voteService;

    public ChallengeVoteController(ChallengeEndVoteService voteService) {
        this.voteService = voteService;
    }

    private String userId(HttpServletRequest req) {
        return (String) req.getAttribute(FirebaseAuthFilter.USER_ID_ATTRIBUTE);
    }

    @GetMapping
    public ChallengeVoteResponse latest(HttpServletRequest req, @PathVariable Long challengeId) {
        return voteService.latest(userId(req), challengeId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ChallengeVoteResponse open(HttpServletRequest req, @PathVariable Long challengeId) {
        return voteService.openVote(userId(req), challengeId);
    }

    @PostMapping("/{voteId}/respond")
    public ChallengeVoteResponse respond(
            HttpServletRequest req,
            @PathVariable Long challengeId,
            @PathVariable Long voteId,
            @Valid @RequestBody RespondRequest request) {
        return voteService.respond(userId(req), challengeId, voteId, request.response());
    }

    public record RespondRequest(@NotBlank String response) {
    }
}
