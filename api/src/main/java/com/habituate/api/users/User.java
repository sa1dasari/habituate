package com.habituate.api.users;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;

/**
 * The first local record keyed by Firebase UID in this codebase — every other
 * feature (friendships, groups, challenges) resolves identity through the
 * Firebase Admin SDK directly rather than a local users table, by design (see
 * CLAUDE.md). Originally existed for exactly one reason — a scheduled job
 * (the reminder scheduler) has no HTTP request to read an X-Timezone header
 * from, so the timezone has to be persisted somewhere — `timezone` is still
 * only ever populated opportunistically by FirebaseAuthFilter. `dateOfBirth`
 * is the first field here that's user-facing: Firebase Auth has no concept
 * of it, so it lives here instead, edited via UserProfileController.
 */
@Entity
@Table(name = "users")
public class User {

    @Id
    private String id;

    @Column
    private String timezone;

    @Column
    private LocalDate dateOfBirth;

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

    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    public void setDateOfBirth(LocalDate dateOfBirth) {
        this.dateOfBirth = dateOfBirth;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
