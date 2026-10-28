package com.habituate.api.coach;

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
@RequestMapping("/api/coach")
public class CoachController {

    private final CoachService coachService;

    public CoachController(CoachService coachService) {
        this.coachService = coachService;
    }

    private String userId(HttpServletRequest req) {
        return (String) req.getAttribute(FirebaseAuthFilter.USER_ID_ATTRIBUTE);
    }

    /** Full persisted thread for this user, oldest first. */
    @GetMapping("/messages")
    public List<CoachMessageResponse> listMessages(HttpServletRequest req) {
        return coachService.listMessages(userId(req));
    }

    /**
     * Returns BOTH the persisted user message (its real id + server-computed
     * aiReaction) and the assistant's reply — the client renders its own
     * optimistic user bubble immediately, but needs this to reconcile it
     * with a real id before it can react to it or show the AI's reaction.
     */
    @PostMapping("/messages")
    @ResponseStatus(HttpStatus.CREATED)
    public AskCoachResponse ask(
            HttpServletRequest req,
            @RequestBody AskCoachRequest request,
            @RequestHeader(value = "X-Timezone", required = false) String timezone) {
        return coachService.ask(userId(req), timezone, request.content());
    }

    /** Confirms a PENDING proposal (ADJUST_HABIT or CREATE_HABIT) — the only place either ever mutates a habit. */
    @PostMapping("/messages/{messageId}/proposal/confirm")
    public CoachMessageResponse confirmProposal(HttpServletRequest req, @PathVariable Long messageId) {
        return coachService.confirmProposal(userId(req), messageId);
    }

    @PostMapping("/messages/{messageId}/proposal/reject")
    public CoachMessageResponse rejectProposal(HttpServletRequest req, @PathVariable Long messageId) {
        return coachService.rejectProposal(userId(req), messageId);
    }

    /**
     * Sets (or, with a null/blank emoji, clears) the authenticated user's own
     * reaction on one message in their own thread — their own bubble or the
     * AI's. One reaction per message per user: a new emoji replaces the old
     * one, the client re-sends the same emoji to toggle it off.
     */
    @PatchMapping("/messages/{messageId}/reaction")
    public CoachMessageResponse setReaction(
            HttpServletRequest req, @PathVariable Long messageId, @RequestBody ReactionRequest request) {
        return coachService.setUserReaction(userId(req), messageId, request.emoji());
    }

    /** Permanent — deletes the user's entire conversation history. */
    @DeleteMapping("/messages")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clearConversation(HttpServletRequest req) {
        coachService.clearConversation(userId(req));
    }
}
