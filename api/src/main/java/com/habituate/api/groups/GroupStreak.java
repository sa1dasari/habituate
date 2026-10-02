package com.habituate.api.groups;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;

/**
 * One row per group, recomputed in place on every relevant check-in event —
 * same upsert-by-natural-key shape as insights.Correlation, just keyed by
 * groupId directly instead of a composite key.
 */
@Entity
@Table(name = "group_streaks")
public class GroupStreak {

    public static final String ACTIVE = "active";
    public static final String AT_RISK = "at_risk";
    public static final String FROZEN = "frozen";

    @Id
    private Long groupId;

    @Column(nullable = false)
    private Integer currentStreak = 0;

    @Column(nullable = false)
    private Integer longestStreak = 0;

    @Column
    private LocalDate lastQualifyingDate;

    @Column(nullable = false, columnDefinition = "varchar(255) not null default 'active'")
    private String status = ACTIVE;

    @Column(nullable = false)
    private Instant updatedAt;

    public GroupStreak() {
    }

    public GroupStreak(Long groupId) {
        this.groupId = groupId;
        this.updatedAt = Instant.now();
    }

    public Long getGroupId() {
        return groupId;
    }

    public Integer getCurrentStreak() {
        return currentStreak;
    }

    public void setCurrentStreak(Integer currentStreak) {
        this.currentStreak = currentStreak;
    }

    public Integer getLongestStreak() {
        return longestStreak;
    }

    public void setLongestStreak(Integer longestStreak) {
        this.longestStreak = longestStreak;
    }

    public LocalDate getLastQualifyingDate() {
        return lastQualifyingDate;
    }

    public void setLastQualifyingDate(LocalDate lastQualifyingDate) {
        this.lastQualifyingDate = lastQualifyingDate;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
