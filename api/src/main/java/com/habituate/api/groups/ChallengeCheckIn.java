package com.habituate.api.groups;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * One row per day a participant logs a challenge, boolean-only (no counter
 * mode — see CLAUDE.md's Challenges note). Progress is the row count for a
 * (challengeId, userId) pair, not a stored running total, so "unlog today"
 * is just deleting the matching row — same shape as a BOOLEAN habit's
 * check-ins, deliberately not reusing the checkins.CheckIn table since a
 * Challenge carries no habit_id to hang it off of.
 */
@Entity
@Table(name = "challenge_check_ins")
public class ChallengeCheckIn {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long challengeId;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private Instant occurredAt;

    public ChallengeCheckIn() {
    }

    public ChallengeCheckIn(Long challengeId, String userId, Instant occurredAt) {
        this.challengeId = challengeId;
        this.userId = userId;
        this.occurredAt = occurredAt;
    }

    public Long getId() {
        return id;
    }

    public Long getChallengeId() {
        return challengeId;
    }

    public String getUserId() {
        return userId;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }
}
