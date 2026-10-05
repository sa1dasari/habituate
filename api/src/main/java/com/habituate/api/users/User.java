package com.habituate.api.users;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * The first local record keyed by Firebase UID in this codebase — every other
 * feature (friendships, groups, challenges) resolves identity through the
 * Firebase Admin SDK directly rather than a local users table, by design (see
 * CLAUDE.md). This table exists for exactly one reason: a scheduled job (the
 * reminder scheduler) has no HTTP request to read an X-Timezone header from,
 * so the timezone has to be persisted somewhere. Populated opportunistically
 * by FirebaseAuthFilter off the X-Timezone header of any authenticated
 * request — never written to directly by a user-facing endpoint.
 */
@Entity
@Table(name = "users")
public class User {

    @Id
    private String id;

    @Column
    private String timezone;

    @Column(nullable = false)
    private Instant updatedAt;

    public User() {
    }

    public User(String id, String timezone) {
        this.id = id;
        this.timezone = timezone;
        this.updatedAt = Instant.now();
    }

    public String getId() {
        return id;
    }

    public String getTimezone() {
        return timezone;
    }

    public void setTimezone(String timezone) {
        this.timezone = timezone;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
