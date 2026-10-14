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
 * Group freezes (groupId set, userId/habitId null) were v1; personal "Shield
 * Day" freezes (userId + habitId set, groupId null) are the deferred feature
 * this was always reserved for — see CLAUDE.md's Shield Days note. One row
 * per (habit, missed day) a shield was spent on.
 */
@Entity
@Table(name = "streak_freezes")
public class StreakFreeze {

    public static final String GROUP_GRACE = "group_grace";
    public static final String PERSONAL_GRACE = "personal_grace";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column
    private String userId;

    @Column
    private Long groupId;

    @Column
    private Long habitId;

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

    /** Personal "Shield Day" freeze — groupId stays null. */
    public StreakFreeze(String userId, Long habitId, LocalDate usedOnDate, String source) {
        this.userId = userId;
        this.habitId = habitId;
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

    public Long getHabitId() {
        return habitId;
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
