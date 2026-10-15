package com.habituate.api.groups;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "groups")
public class Group {

    public static final String ALL_MEMBERS = "ALL_MEMBERS";
    public static final String ANY_MEMBER = "ANY_MEMBER";

    /** UNIFIED: every member's linked habit is expected to share the same target (e.g.
     * everyone drinks 80oz). SPLIT: members track their own parallel goal under the same
     * shared dashboard (e.g. one runs, one cycles). Informational/display only in v1 — not
     * enforced against each member's habit target, matching this app's non-prescriptive
     * stance elsewhere (e.g. the free-text gender field). */
    public static final String UNIFIED = "UNIFIED";
    public static final String SPLIT = "SPLIT";

    /** COOPERATIVE: one shared group_streaks counter that only ticks forward if every
     * member qualifies (per streakRule) — the original, still-default design. INDEPENDENT:
     * no shared counter at all — each member just sees everyone's own personal streak
     * side-by-side (GroupStreakConsumer/StreakFreezeScheduler skip these groups entirely). */
    public static final String COOPERATIVE = "COOPERATIVE";
    public static final String INDEPENDENT = "INDEPENDENT";

    /** FULL_DETAILS: groupmates see each other's exact logged amount (e.g. "5 reps").
     * STATUS_ONLY: groupmates only see a binary completed/not, never the amount. */
    public static final String FULL_DETAILS = "FULL_DETAILS";
    public static final String STATUS_ONLY = "STATUS_ONLY";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String createdBy;

    @Column(nullable = false)
    private String streakRule;

    @Column(nullable = false, columnDefinition = "varchar(255) not null default 'UNIFIED'")
    private String goalAlignment = UNIFIED;

    @Column(nullable = false, columnDefinition = "varchar(255) not null default 'COOPERATIVE'")
    private String trackingMode = COOPERATIVE;

    @Column(nullable = false, columnDefinition = "varchar(255) not null default 'FULL_DETAILS'")
    private String visibilityLevel = FULL_DETAILS;

    @Column(nullable = false, columnDefinition = "boolean not null default true")
    private boolean nudgesEnabled = true;

    /** "Missed Day Rules" — how many group-grace freezes StreakFreezeScheduler may auto-apply
     * in a rolling 30-day window before letting the streak actually reset. Matches the
     * original hardcoded behavior (1) as the default for backward compatibility. */
    @Column(nullable = false, columnDefinition = "integer not null default 1")
    private int skipDaysPerMonth = 1;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public Group() {
    }

    public Group(String name, String createdBy, String streakRule) {
        this.name = name;
        this.createdBy = createdBy;
        this.streakRule = streakRule;
    }

    public Group(String name, String createdBy, String streakRule, String goalAlignment, String trackingMode,
                 String visibilityLevel, boolean nudgesEnabled, int skipDaysPerMonth) {
        this.name = name;
        this.createdBy = createdBy;
        this.streakRule = streakRule;
        this.goalAlignment = goalAlignment == null ? UNIFIED : goalAlignment;
        this.trackingMode = trackingMode == null ? COOPERATIVE : trackingMode;
        this.visibilityLevel = visibilityLevel == null ? FULL_DETAILS : visibilityLevel;
        this.nudgesEnabled = nudgesEnabled;
        this.skipDaysPerMonth = skipDaysPerMonth < 0 ? 0 : skipDaysPerMonth;
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

    public void setName(String name) {
        this.name = name;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public String getStreakRule() {
        return streakRule;
    }

    public void setStreakRule(String streakRule) {
        this.streakRule = streakRule;
    }

    public String getGoalAlignment() {
        return goalAlignment;
    }

    public void setGoalAlignment(String goalAlignment) {
        this.goalAlignment = goalAlignment;
    }

    public String getTrackingMode() {
        return trackingMode;
    }

    public void setTrackingMode(String trackingMode) {
        this.trackingMode = trackingMode;
    }

    public String getVisibilityLevel() {
        return visibilityLevel;
    }

    public void setVisibilityLevel(String visibilityLevel) {
        this.visibilityLevel = visibilityLevel;
    }

    public boolean isNudgesEnabled() {
        return nudgesEnabled;
    }

    public void setNudgesEnabled(boolean nudgesEnabled) {
        this.nudgesEnabled = nudgesEnabled;
    }

    public int getSkipDaysPerMonth() {
        return skipDaysPerMonth;
    }

    public void setSkipDaysPerMonth(int skipDaysPerMonth) {
        this.skipDaysPerMonth = skipDaysPerMonth;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
