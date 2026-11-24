package com.habituate.api.billing;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * RevenueCat → backend, server-to-server, not a Firebase-authenticated
 * client request (excluded in FirebaseAuthFilter.shouldNotFilter, owner
 * go-ahead 2026-11-24). Authenticated instead by RevenueCat's "static
 * Authorization header" option (the simpler of its two documented auth
 * modes — HMAC signature verification is the stronger alternative but
 * wasn't implemented this pass): the dashboard is configured to send a
 * fixed Authorization header value, compared here against
 * REVENUECAT_WEBHOOK_SECRET. An unset secret rejects every request rather
 * than accepting an unauthenticated one.
 */
@RestController
public class RevenueCatWebhookController {

    private final EntitlementService entitlementService;
    private final String webhookSecret;

    public RevenueCatWebhookController(
            EntitlementService entitlementService,
            @Value("${revenuecat.webhook-secret:}") String webhookSecret) {
        this.entitlementService = entitlementService;
        this.webhookSecret = webhookSecret;
    }

    @PostMapping("/api/webhooks/revenuecat")
    public ResponseEntity<Void> handleWebhook(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody RevenueCatWebhookRequest body) {
        if (!isAuthorized(authorization)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        entitlementService.applyWebhookEvent(body == null ? null : body.event());
        return ResponseEntity.ok().build();
    }

    private boolean isAuthorized(String authorization) {
        if (webhookSecret == null || webhookSecret.isBlank() || authorization == null) {
            return false;
        }
        byte[] expected = webhookSecret.getBytes(StandardCharsets.UTF_8);
        byte[] actual = authorization.getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(expected, actual);
    }
}
