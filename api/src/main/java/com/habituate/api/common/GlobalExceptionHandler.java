package com.habituate.api.common;

import jakarta.persistence.EntityNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/**
 * Without this, EntityNotFoundException and ForbiddenException both fell
 * through to Spring's default handling and came back as a generic 500,
 * masking a missing resource or an authorization failure as a server bug and
 * giving the mobile client nothing to branch on.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleNotFound(EntityNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<Map<String, String>> handleForbidden(ForbiddenException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(DuplicateCheckInException.class)
    public ResponseEntity<Map<String, String>> handleDuplicateCheckIn(DuplicateCheckInException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(DuplicateFriendRequestException.class)
    public ResponseEntity<Map<String, String>> handleDuplicateFriendRequest(DuplicateFriendRequestException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleBadRequest(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(CoachUnavailableException.class)
    public ResponseEntity<Map<String, String>> handleCoachUnavailable(CoachUnavailableException ex) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", ex.getMessage()));
    }

    /** Fires when a @Valid-annotated @RequestBody (e.g. CreateHabitRequest) fails Bean
     * Validation — reports just the first field error's own message, in the same
     * {"error": "..."} shape as every other handler here, rather than dumping the whole
     * exception (which carries one FieldError per failed constraint). */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException ex) {
        FieldError firstError = ex.getBindingResult().getFieldErrors().stream().findFirst().orElse(null);
        String message = firstError != null
                ? firstError.getField() + " " + firstError.getDefaultMessage()
                : "Invalid request";
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", message));
    }

    /** Catch-all fallback — without this, an unexpected exception (NPE, a constraint
     * violation that isn't one of the named types above, etc.) fell through to Spring's
     * default error body instead of this app's own {"error": "..."} convention. Never
     * exposes the real exception message/stacktrace to the client; only logs it. */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleUnexpected(Exception ex) {
        log.error("Unhandled exception", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Something went wrong"));
    }
}
