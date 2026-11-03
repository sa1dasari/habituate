package com.habituate.api.groups;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;

/**
 * Permanent, per-user removal of a check-in from the viewer's own "Recent
 * activity" feed (swipe to dismiss) — never deletes the underlying CheckIn
 * or affects any other groupmate's feed, just this viewer's. One row per
 * (checkInId, userId), same shape as CheckInCheer.
 */
@Entity
@Table(name = "activity_dismissals", uniqueConstraints = @UniqueConstraint(columnNames = {"check_in_id", "user_id"}))
public class ActivityDismissal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "check_in_id", nullable = false)
    private Long checkInId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public ActivityDismissal() {
    }

    public ActivityDismissal(Long checkInId, String userId) {
        this.checkInId = checkInId;
        this.userId = userId;
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Long getCheckInId() {
        return checkInId;
    }

    public String getUserId() {
        return userId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
