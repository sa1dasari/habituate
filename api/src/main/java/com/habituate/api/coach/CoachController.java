package com.habituate.api.coach;

import com.habituate.api.config.FirebaseAuthFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
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

    /** Only the new assistant reply — the client already knows what it just asked. */
    @PostMapping("/messages")
    @ResponseStatus(HttpStatus.CREATED)
    public CoachMessageResponse ask(
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

    /** Permanent — deletes the user's entire conversation history. */
    @DeleteMapping("/messages")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clearConversation(HttpServletRequest req) {
        coachService.clearConversation(userId(req));
    }
}
