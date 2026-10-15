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
import java.time.LocalTime;

/**
 * Per CLAUDE.md: "a time-boxed, multi-person goal with a progress bar, not a
 * running streak" — deliberately not sharing a table with Group/GroupStreak.
 * No habit linkage (unlike Shared Habits) — progress is derived from
 * ChallengeCheckIn rows rather than a bare counter, so a day can be unlogged.
 *
 * Unlike Shared Habits (private-only, friendship-gated invites), a Challenge
 * can be PUBLIC — discoverable and joinable by anyone via "browse" — or
 * PRIVATE, which only hides it from browse; join() still works by id either
 * way, and {@link ChallengeService#invite} additionally lets a friend be
 * added directly (mirrors GroupService.invite, minus the accept step —
 * a Challenge has no per-member setup like picking a habit to link).
 *
 * Raid/team-pooled mode (INDIVIDUAL/RAID) was built, shipped, then removed
 * 2026-10-14 per explicit user request — see CLAUDE.md/SKILLS.md.
 */
@Entity
@Table(name = "challenges")
public class Challenge {

    public static final String PUBLIC = "PUBLIC";
    public static final String PRIVATE = "PRIVATE";

    /** BOOLEAN: a simple once-a-day check-off, progress = days logged (the original design).
     * COUNT: a quantitative/time goal (e.g. "80oz water", "30 min reading") — any number of
     * logs a day, each carrying a value, progress = sum of values, mirrors habits.tracking_mode. */
    public static final String BOOLEAN = "BOOLEAN";
    public static final String COUNT = "COUNT";

    /** DAILY: expected every day (the original design, still the default).
     * WEEKLY_QUOTA: expected weeklyQuota times a week, any days.
     * CUSTOM_DAYS: expected only on the weekdays listed in customDays.
     * Informational/display only in v1 — not enforced against check-in attempts, matching
     * this app's non-prescriptive stance elsewhere (e.g. the free-text gender field). */
    public static final String DAILY = "DAILY";
    public static final String WEEKLY_QUOTA = "WEEKLY_QUOTA";
    public static final String CUSTOM_DAYS = "CUSTOM_DAYS";

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

    /** Nullable = open-ended (no fixed end date), per the user's "Challenge Duration" spec. */
    @Column
    private LocalDate periodEnd;

    @Column(nullable = false, columnDefinition = "varchar(255) default 'PRIVATE'")
    private String visibility;

    @Column
    private String icon;

    @Column
    private String color;

    @Column(nullable = false, columnDefinition = "varchar(255) not null default 'BOOLEAN'")
    private String trackingMode = BOOLEAN;

    @Column(nullable = false, columnDefinition = "varchar(255) not null default 'DAILY'")
    private String cadenceType = DAILY;

    @Column
    private Integer weeklyQuota;

    /** CSV of ISO weekday numbers (1=Monday..7=Sunday), e.g. "1,3,5". Only set when cadenceType is CUSTOM_DAYS. */
    @Column
    private String customDays;

    @Column
    private LocalTime reminderTime;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public Challenge() {
    }

    public Challenge(String name, String description, String createdBy, Integer targetCount,
                      LocalDate periodStart, LocalDate periodEnd, String visibility) {
        this(name, description, createdBy, targetCount, periodStart, periodEnd, visibility,
                null, null, BOOLEAN, DAILY, null, null, null);
    }

    public Challenge(String name, String description, String createdBy, Integer targetCount,
                      LocalDate periodStart, LocalDate periodEnd, String visibility,
                      String icon, String color, String trackingMode, String cadenceType,
                      Integer weeklyQuota, String customDays, LocalTime reminderTime) {
        this.name = name;
        this.description = description;
        this.createdBy = createdBy;
        this.targetCount = targetCount;
        this.periodStart = periodStart;
        this.periodEnd = periodEnd;
        this.visibility = visibility;
        this.icon = icon;
        this.color = color;
        this.trackingMode = trackingMode == null ? BOOLEAN : trackingMode;
        this.cadenceType = cadenceType == null ? DAILY : cadenceType;
        this.weeklyQuota = weeklyQuota;
        this.customDays = customDays;
        this.reminderTime = reminderTime;
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

    public String getIcon() {
        return icon;
    }

    public String getColor() {
        return color;
    }

    public String getTrackingMode() {
        return trackingMode;
    }

    public String getCadenceType() {
        return cadenceType;
    }

    public Integer getWeeklyQuota() {
        return weeklyQuota;
    }

    public String getCustomDays() {
        return customDays;
    }

    public LocalTime getReminderTime() {
        return reminderTime;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
