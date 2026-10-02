package com.habituate.api.groups;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * A Shared Habit isn't one literal habit row multiple people write to —
 * habits.user_id is a single owner everywhere else in this codebase, and
 * loosening that would mean rewriting ownership checks throughout. Instead,
 * each member keeps their own personal habit (their own row, their own
 * private streak/history), and this row just links *that member's own*
 * habitId to the group. habitId is null until an invited member accepts and
 * picks which of their habits to link.
 */
@Entity
@Table(name = "group_members")
public class GroupMember {

    public static final String PENDING = "PENDING";
    public static final String ACTIVE = "ACTIVE";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long groupId;

    @Column(nullable = false)
    private String userId;

    @Column
    private Long habitId;

    @Column(nullable = false, columnDefinition = "varchar(255) not null default 'PENDING'")
    private String status = PENDING;

    @Column(nullable = false, updatable = false)
    private Instant joinedAt;

    public GroupMember() {
    }

    public GroupMember(Long groupId, String userId, Long habitId, String status) {
        this.groupId = groupId;
        this.userId = userId;
        this.habitId = habitId;
        this.status = status;
    }

    @PrePersist
    public void prePersist() {
        this.joinedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Long getGroupId() {
        return groupId;
    }

    public String getUserId() {
        return userId;
    }

    public Long getHabitId() {
        return habitId;
    }

    public void setHabitId(Long habitId) {
        this.habitId = habitId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Instant getJoinedAt() {
        return joinedAt;
    }
}
