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
