package com.habituate.api.common;

import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Before this handler existed, EntityNotFoundException and ownership
 * violations both fell through to Spring's default handling and came back
 * as a generic 500, masking real 404/403/409/400 cases as server bugs.
 */
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void notFound_mapsTo404() {
        ResponseEntity<?> response = handler.handleNotFound(new EntityNotFoundException("Habit not found: 1"));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void forbidden_mapsTo403() {
        ResponseEntity<?> response = handler.handleForbidden(new ForbiddenException("Habit does not belong to user"));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void duplicateCheckIn_mapsTo409() {
        ResponseEntity<?> response = handler.handleDuplicateCheckIn(new DuplicateCheckInException("Already checked in"));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void badRequest_mapsTo400() {
        ResponseEntity<?> response = handler.handleBadRequest(new IllegalArgumentException("Invalid period"));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
