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
 * A lightweight "cheer" reaction on a groupmate's check-in, shown in the
 * Profile page's Shared Progress feed. One cheer per (checkInId, userId) —
 * toggled on/off, not a count a single user can rack up.
 */
@Entity
@Table(name = "check_in_cheers", uniqueConstraints = @UniqueConstraint(columnNames = {"check_in_id", "user_id"}))
public class CheckInCheer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "check_in_id", nullable = false)
    private Long checkInId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public CheckInCheer() {
    }

    public CheckInCheer(Long checkInId, String userId) {
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
