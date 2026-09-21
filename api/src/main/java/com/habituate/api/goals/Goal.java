package com.habituate.api.goals;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;

/**
 * A freeform goal — a target with no underlying habit to derive progress
 * from (e.g. "Save $500 this month"), so progress is a manually adjusted
 * counter rather than something computed from check-ins.
 *
 * Habit-linked goals (a habit whose own weekly/monthly target is pinned into
 * the Goals section) are NOT represented here — they're just a habit with
 * featuredGoal=true, reusing its existing target and check-ins. Storing a
 * second copy of that target here would let the two drift out of sync.
 */
@Entity
@Table(name = "goals")
public class Goal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private String description;

    /** WEEKLY or MONTHLY — which window targetCount applies to. */
    @Column(nullable = false)
    private String period;

    @Column(nullable = false)
    private Integer targetCount;

    @Column(nullable = false)
    private Integer currentCount = 0;

    /**
     * Start date (local, client-computed) of the period this goal is
     * currently tracking. When the client's own notion of "this week/month"
     * has moved past this date, the goal is due for review before it can be
     * rolled into the new period — see GoalController's /rollover endpoint.
     */
    @Column(nullable = false)
    private LocalDate periodStart;

    @Column(nullable = false, columnDefinition = "boolean not null default false")
    private boolean archived = false;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    public Goal() {
    }

    public Goal(String userId, String description, String period, Integer targetCount, LocalDate periodStart) {
        this.userId = userId;
        this.description = description;
        this.period = period;
        this.targetCount = targetCount;
        this.periodStart = periodStart;
    }

    @PrePersist
    public void prePersist() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getPeriod() {
        return period;
    }

    public void setPeriod(String period) {
        this.period = period;
    }

    public Integer getTargetCount() {
        return targetCount;
    }

    public void setTargetCount(Integer targetCount) {
        this.targetCount = targetCount;
    }

    public Integer getCurrentCount() {
        return currentCount;
    }

    public void setCurrentCount(Integer currentCount) {
        this.currentCount = currentCount;
    }

    public LocalDate getPeriodStart() {
        return periodStart;
    }

    public void setPeriodStart(LocalDate periodStart) {
        this.periodStart = periodStart;
    }

    public boolean isArchived() {
        return archived;
    }

    public void setArchived(boolean archived) {
        this.archived = archived;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
