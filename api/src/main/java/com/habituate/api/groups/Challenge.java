package com.habituate.api.groups;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Per CLAUDE.md: "a time-boxed, multi-person goal with a progress bar, not a
 * running streak" — deliberately not sharing a table with Group/GroupStreak.
 * No habit linkage (unlike Shared Habits) — progress is a boolean once-a-day
 * log, derived from ChallengeCheckIn rows (same shape as a BOOLEAN habit's
 * check-ins) rather than a bare counter, so a day can be unlogged.
 *
 * Unlike Shared Habits (private-only, friendship-gated invites), a Challenge
 * can be PUBLIC — discoverable and joinable by anyone via "browse" — or
 * PRIVATE, which only hides it from browse; join() still works by id either
 * way since there's no challenge-invite system yet.
 */
@Entity
@Table(name = "challenges")
public class Challenge {

    public static final String PUBLIC = "PUBLIC";
    public static final String PRIVATE = "PRIVATE";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column
    private String description;

    @Column(nullable = false)
    private String createdBy;

    @Column(nullable = false)
    private Integer targetCount;

    @Column(nullable = false)
    private LocalDate periodStart;

    @Column(nullable = false)
    private LocalDate periodEnd;

    @Column(nullable = false, columnDefinition = "varchar(255) default 'PRIVATE'")
    private String visibility;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public Challenge() {
    }

    public Challenge(String name, String description, String createdBy, Integer targetCount,
                      LocalDate periodStart, LocalDate periodEnd, String visibility) {
        this.name = name;
        this.description = description;
        this.createdBy = createdBy;
        this.targetCount = targetCount;
        this.periodStart = periodStart;
        this.periodEnd = periodEnd;
        this.visibility = visibility;
    }

    @PrePersist
    public void prePersist() {
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public Integer getTargetCount() {
        return targetCount;
    }

    public LocalDate getPeriodStart() {
        return periodStart;
    }

    public LocalDate getPeriodEnd() {
        return periodEnd;
    }

    public String getVisibility() {
        return visibility;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
