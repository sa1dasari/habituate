package com.habituate.api.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Launch-readiness item (SKYLINE.md Phase 8): limits the two endpoints with
 * real abuse/cost exposure. Runs after FirebaseAuthFilter in the chain (see
 * SecurityConfig) so USER_ID_ATTRIBUTE is already set for the coach case.
 *
 * Coach messages hit the real Anthropic API — a retry loop or a scripted
 * abuser could run up a real bill. Keyed per userId since that's already
 * authenticated and more precise than an IP behind Railway's shared egress.
 *
 * username-email is pre-auth (FirebaseAuthFilter explicitly skips it — see
 * its own shouldNotFilter) and resolves a typed username to the email
 * Firebase sign-in needs, which makes it a username-enumeration vector if
 * left unlimited. Keyed per IP since there's no userId yet.
 *
 * Both limits are deliberately generous for a real user and tight for a
 * script: a real coach conversation or login flow never approaches either.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final String COACH_MESSAGES_PATH = "/api/coach/messages";
    private static final int COACH_MAX_PER_HOUR = 20;
    private static final long HOUR_SECONDS = 3600;

    private static final String USERNAME_EMAIL_PATH = "/api/auth/username-email";
    private static final int USERNAME_EMAIL_MAX_PER_MINUTE = 20;
    private static final long MINUTE_SECONDS = 60;

    private final RateLimiter coachLimiter = new RateLimiter();
    private final RateLimiter usernameEmailLimiter = new RateLimiter();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        boolean isCoachSend = "POST".equalsIgnoreCase(request.getMethod()) && path.equals(COACH_MESSAGES_PATH);
        boolean isUsernameEmailLookup = path.equals(USERNAME_EMAIL_PATH);
        return !isCoachSend && !isUsernameEmailLookup;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI();

        if (path.equals(COACH_MESSAGES_PATH)) {
            Object userId = request.getAttribute(FirebaseAuthFilter.USER_ID_ATTRIBUTE);
            String key = userId != null ? userId.toString() : clientIp(request);
            if (!coachLimiter.tryConsume(key, COACH_MAX_PER_HOUR, HOUR_SECONDS)) {
                sendTooManyRequests(response, "Too many messages to Ask Habituate — try again in a little while.");
                return;
            }
        } else if (path.equals(USERNAME_EMAIL_PATH)) {
            if (!usernameEmailLimiter.tryConsume(clientIp(request), USERNAME_EMAIL_MAX_PER_MINUTE, MINUTE_SECONDS)) {
                sendTooManyRequests(response, "Too many attempts — try again in a minute.");
                return;
            }
        }

        chain.doFilter(request, response);
    }

    private static final int HTTP_TOO_MANY_REQUESTS = 429; // not in jakarta.servlet's HttpServletResponse constants

    private void sendTooManyRequests(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HTTP_TOO_MANY_REQUESTS);
        response.setContentType("application/json");
        // Matches GlobalExceptionHandler's {"error": "..."} shape — this
        // filter runs before the DispatcherServlet, so that advice never
        // sees it; the client's api/client.js parses this field either way.
        response.getWriter().write("{\"error\":\"" + message.replace("\"", "'") + "\"}");
    }

    /** Both maps are keyed per userId/IP and grow by one entry per distinct
     * caller ever seen — unbounded without this. Same cron-style convention
     * as the other @Scheduled jobs in this codebase (e.g.
     * ChallengeReminderScheduler); 2 hours comfortably exceeds both
     * limiters' own window sizes (1h, 1min), so nothing live gets evicted
     * mid-window. */
    @Scheduled(cron = "0 0 * * * *")
    public void evictStaleEntries() {
        coachLimiter.evictStaleEntries(2 * HOUR_SECONDS);
        usernameEmailLimiter.evictStaleEntries(2 * HOUR_SECONDS);
    }

    private String clientIp(HttpServletRequest request) {
        // Railway sits behind a proxy — the real client IP arrives via
        // X-Forwarded-For, not request.getRemoteAddr() (which would just be
        // the proxy's own address for every caller).
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
