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
 * No habit linkage (unlike Shared Habits) — progress is logged directly via
 * ChallengeParticipant.progressCount, mirroring GoalService's
 * create/adjustProgress pattern rather than deriving from check-ins.
 */
@Entity
@Table(name = "challenges")
public class Challenge {

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

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public Challenge() {
    }

    public Challenge(String name, String description, String createdBy, Integer targetCount,
                      LocalDate periodStart, LocalDate periodEnd) {
        this.name = name;
        this.description = description;
        this.createdBy = createdBy;
        this.targetCount = targetCount;
        this.periodStart = periodStart;
        this.periodEnd = periodEnd;
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

    public Instant getCreatedAt() {
        return createdAt;
    }
}
