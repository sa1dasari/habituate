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
 * groupId-only for v1 (personal habit streak freezes are a deliberate,
 * documented deferral — see SKILLS.md Phase 7 notes — personal
 * streak-pressure mechanics don't exist yet to need freezing). userId kept
 * nullable so the table doesn't need a schema change when that lands.
 */
@Entity
@Table(name = "streak_freezes")
public class StreakFreeze {

    public static final String GROUP_GRACE = "group_grace";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column
    private String userId;

    @Column
    private Long groupId;

    @Column(nullable = false)
    private LocalDate usedOnDate;

    @Column(nullable = false)
    private String source;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public StreakFreeze() {
    }

    public StreakFreeze(Long groupId, LocalDate usedOnDate, String source) {
        this.groupId = groupId;
        this.usedOnDate = usedOnDate;
        this.source = source;
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

    public Long getGroupId() {
        return groupId;
    }

    public LocalDate getUsedOnDate() {
        return usedOnDate;
    }

    public String getSource() {
        return source;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
