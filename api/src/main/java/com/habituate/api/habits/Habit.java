package com.habituate.api.habits;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalTime;

@Entity
@Table(name = "habits")
public class Habit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String category;

    @Column(nullable = false)
    private String cadenceType;

    @Column(nullable = false)
    private Integer cadenceTarget = 1;

    /**
     * Optional targets at weekly and monthly scale, independent of cadenceTarget.
     * A gym habit can have cadenceTarget=1 (daily), weeklyTarget=3, monthlyTarget=10
     * all at once. Null means "no target set at that scale".
     */
    @Column
    private Integer weeklyTarget;

    @Column
    private Integer monthlyTarget;

    /**
     * BOOLEAN: one check-in per day, toggled on/off (default — "did it happen today").
     * COUNT: any number of check-ins per day, each carrying a value; period progress
     * sums the values instead of counting days. Needed for targets like "50 job
     * applications this month" that can't be satisfied one-per-day.
     */
    @Column(nullable = false, columnDefinition = "varchar(255) not null default 'BOOLEAN'")
    private String trackingMode = "BOOLEAN";

    /** Optional time of day the user intends to do the habit. Never enforced. */
    @Column(name = "scheduled_time")
    private LocalTime scheduledTime;

    /** Only meaningful with a scheduled time; delivery lands with FCM in Phase 9. */
    @Column(nullable = false, columnDefinition = "boolean not null default false")
    private boolean reminderEnabled = false;

    @Column(nullable = false, columnDefinition = "boolean not null default false")
    private boolean archived = false;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    public Habit() {
    }

    public Habit(String userId, String name, String category, String cadenceType, Integer cadenceTarget) {
        this.userId = userId;
        this.name = name;
        this.category = category;
        this.cadenceType = cadenceType;
        this.cadenceTarget = cadenceTarget;
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

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getCadenceType() {
        return cadenceType;
    }

    public void setCadenceType(String cadenceType) {
        this.cadenceType = cadenceType;
    }

    public Integer getCadenceTarget() {
        return cadenceTarget;
    }

    public void setCadenceTarget(Integer cadenceTarget) {
        this.cadenceTarget = cadenceTarget;
    }

    public Integer getWeeklyTarget() {
        return weeklyTarget;
    }

    public void setWeeklyTarget(Integer weeklyTarget) {
        this.weeklyTarget = weeklyTarget;
    }

    public Integer getMonthlyTarget() {
        return monthlyTarget;
    }

    public void setMonthlyTarget(Integer monthlyTarget) {
        this.monthlyTarget = monthlyTarget;
    }

    public String getTrackingMode() {
        return trackingMode;
    }

    public void setTrackingMode(String trackingMode) {
        this.trackingMode = trackingMode;
    }

    public LocalTime getScheduledTime() {
        return scheduledTime;
    }

    public void setScheduledTime(LocalTime scheduledTime) {
        this.scheduledTime = scheduledTime;
    }

    public boolean isReminderEnabled() {
        return reminderEnabled;
    }

    public void setReminderEnabled(boolean reminderEnabled) {
        this.reminderEnabled = reminderEnabled;
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
