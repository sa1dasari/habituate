package com.habituate.api.insights;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.habituate.api.config.FirebaseAuthFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/insights")
public class InsightController {

    private final InsightService insightService;
    private final ObjectMapper objectMapper;

    public InsightController(InsightService insightService, ObjectMapper objectMapper) {
        this.insightService = insightService;
        this.objectMapper = objectMapper;
    }

    private String userId(HttpServletRequest req) {
        return (String) req.getAttribute(FirebaseAuthFilter.USER_ID_ATTRIBUTE);
    }

    @GetMapping
    public List<InsightResponse> list(HttpServletRequest req) {
        return insightService.listActive(userId(req)).stream()
                .map(insight -> InsightResponse.from(insight, objectMapper))
                .toList();
    }

    /**
     * Recomputes just the calling user's own insights on demand — the nightly
     * job (InsightScheduler) covers everyone automatically; this exists so
     * the mobile app can offer an immediate "refresh" instead of waiting
     * until 3am, and so this can be tested without waiting for the cron.
     */
    @PostMapping("/recompute")
    public List<InsightResponse> recompute(HttpServletRequest req) {
        String uid = userId(req);
        insightService.computeForUser(uid);
        return insightService.listActive(uid).stream()
                .map(insight -> InsightResponse.from(insight, objectMapper))
                .toList();
    }

    @PostMapping("/{insightId}/dismiss")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void dismiss(HttpServletRequest req, @PathVariable Long insightId) {
        insightService.dismiss(userId(req), insightId);
    }
}
