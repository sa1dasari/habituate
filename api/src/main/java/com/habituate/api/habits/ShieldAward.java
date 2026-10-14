package com.habituate.api.habits;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * One row per Shield Day a user has ever earned, by hitting a 7-day
 * multiple on some habit's streak (see ShieldAwardService). A user's
 * available balance is derived (awards minus personal StreakFreeze rows
 * already spent), not stored directly, so there's one source of truth.
 */
@Entity
@Table(name = "shield_awards")
public class ShieldAward {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private Long habitId;

    @Column(nullable = false)
    private Integer streakLength;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public ShieldAward() {
    }

    public ShieldAward(String userId, Long habitId, Integer streakLength) {
        this.userId = userId;
        this.habitId = habitId;
        this.streakLength = streakLength;
    }

    @PrePersist
    public void prePersist() {
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public String getUserId() {
        return userId;
    }

    public Long getHabitId() {
        return habitId;
    }

    public Integer getStreakLength() {
        return streakLength;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
