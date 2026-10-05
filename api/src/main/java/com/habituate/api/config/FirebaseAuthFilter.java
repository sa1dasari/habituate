package com.habituate.api.config;

import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import com.habituate.api.users.UserTimezoneService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Verifies the Firebase ID token on every request to /api/** (except /api/health).
 *
 * On success: sets the "userId" request attribute to the Firebase UID.
 * On failure: returns 401 Unauthorized.
 *
 * When Firebase is not initialised (no service-account-path configured), the
 * filter falls back to "demo-user" so local development without a Firebase
 * project still works. This fallback must never reach production.
 */
@Component
public class FirebaseAuthFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(FirebaseAuthFilter.class);
    public static final String USER_ID_ATTRIBUTE = "userId";
    private static final String DEMO_USER_ID = "demo-user";

    private final UserTimezoneService userTimezoneService;

    public FirebaseAuthFilter(UserTimezoneService userTimezoneService) {
        this.userTimezoneService = userTimezoneService;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        // Health check is always public.
        return path.equals("/api/health") || path.startsWith("/actuator/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {

        // Dev fallback: no Firebase project configured.
        if (FirebaseApp.getApps().isEmpty()) {
            request.setAttribute(USER_ID_ATTRIBUTE, DEMO_USER_ID);
            recordTimezoneQuietly(DEMO_USER_ID, request.getHeader("X-Timezone"));
            chain.doFilter(request, response);
            return;
        }

        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Missing or invalid Authorization header");
            return;
        }

        String idToken = authHeader.substring(7);
        try {
            FirebaseToken decoded = FirebaseAuth.getInstance().verifyIdToken(idToken);
            request.setAttribute(USER_ID_ATTRIBUTE, decoded.getUid());
            recordTimezoneQuietly(decoded.getUid(), request.getHeader("X-Timezone"));
            chain.doFilter(request, response);
        } catch (FirebaseAuthException e) {
            log.warn("Firebase token verification failed: {}", e.getMessage());
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid or expired token");
        }
    }

    // Opportunistic side effect of an authenticated request — must never fail the request itself.
    private void recordTimezoneQuietly(String userId, String timezone) {
        try {
            userTimezoneService.recordTimezone(userId, timezone);
        } catch (Exception e) {
            log.warn("Could not record timezone for {}: {}", userId, e.getMessage());
        }
    }
}
