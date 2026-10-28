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

    /** Mandatory for every account going forward, but nullable at the DB level: existing
     * accounts predate this field, and this project's own convention (ddl-auto=update, no
     * migration tool) is to enforce "mandatory" at the app layer rather than a backfill
     * migration — the mobile app gates entry behind a "choose a username" screen whenever
     * GET /api/users/me comes back with username=null. Stored canonically lowercase (like
     * Reddit, not case-preserving like Twitter) so uniqueness is just a plain unique index,
     * no second normalized column needed. */
    @Column(unique = true)
    private String username;

    @Column
    private LocalDate dateOfBirth;

    @Column
    private String phoneNumber;

    @Column
    private String address;

    @Column
    private String gender;

    public static final String VISIBILITY_PUBLIC = "PUBLIC";
    public static final String VISIBILITY_PRIVATE = "PRIVATE";

    /** Default PRIVATE for every account, new or existing — enforced at the app layer (same
     * ddl-auto=update, no-migration-tool convention as the rest of this table): the column
     * default covers rows inserted going forward, and {@link #getProfileVisibility()} falls
     * back to PRIVATE for any pre-existing row where the column reads back null. Controls what
     * a friend sees on this user's profile via FriendProfileService — PRIVATE shows only
     * name/username/avatar plus any mutual Shared Habit group streak, PUBLIC additionally shows
     * aggregate stats (never the raw per-habit list). */
    @Column(nullable = false, columnDefinition = "varchar(255) not null default 'PRIVATE'")
    private String profileVisibility = VISIBILITY_PRIVATE;

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

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    public void setDateOfBirth(LocalDate dateOfBirth) {
        this.dateOfBirth = dateOfBirth;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getGender() {
        return gender;
    }

    public void setGender(String gender) {
        this.gender = gender;
    }

    /** Never returns null, even for a pre-existing row where the column itself reads back null
     * — PRIVATE is the safe default on both sides of the column-default/app-layer split. */
    public String getProfileVisibility() {
        return profileVisibility == null ? VISIBILITY_PRIVATE : profileVisibility;
    }

    public void setProfileVisibility(String profileVisibility) {
        this.profileVisibility = profileVisibility;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
