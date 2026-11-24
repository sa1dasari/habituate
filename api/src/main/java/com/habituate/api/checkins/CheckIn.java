package com.habituate.api.checkins;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * Launch-readiness indexes (SKYLINE.md Phase 8), matched to
 * CheckInRepository's actual query methods rather than guessed: user_id +
 * habit_id for findByUserIdAndHabitId* (the hot path — every hydrate() call)
 * and findByUserId/deleteByUserId; habit_id + occurred_at for the
 * exists/count-between queries (group-period qualification, duplicate
 * check); group_id + occurred_at for the friend-activity feed. Deliberately
 * not indexed: findDistinctUserIdsSince's plain occurred_at filter — it's
 * the nightly insights batch job, not a per-request path, lower priority.
 * `ddl-auto=update` is known to be inconsistent about adding indexes to an
 * existing table on some Hibernate/dialect combinations — not verified
 * against a live database this session (confirm with `\d check_ins` in
 * psql after the next deploy).
 */
@Entity
@Table(
        name = "check_ins",
        indexes = {
                @Index(name = "idx_checkins_user_habit", columnList = "userId, habitId"),
                @Index(name = "idx_checkins_habit_occurred", columnList = "habitId, occurredAt"),
                @Index(name = "idx_checkins_group_occurred", columnList = "groupId, occurredAt")
        }
)
public class CheckIn {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long habitId;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private Instant occurredAt;

    @Column(nullable = false)
    private Integer value = 1;

    @Column(nullable = false)
    private String source = "manual";

    /** Set when this check-in's habit is linked to a group — see groups.GroupMember. */
    @Column
    private Long groupId;

    public CheckIn() {
    }

    public CheckIn(Long habitId, String userId, Instant occurredAt, Integer value, String source) {
        this.habitId = habitId;
        this.userId = userId;
        this.occurredAt = occurredAt;
        this.value = value;
        this.source = source;
    }

    @PrePersist
    public void prePersist() {
        if (this.occurredAt == null) {
            this.occurredAt = Instant.now();
        }
    }

    public Long getId() {
        return id;
    }

    public Long getHabitId() {
        return habitId;
    }

    public void setHabitId(Long habitId) {
        this.habitId = habitId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }

    public void setOccurredAt(Instant occurredAt) {
        this.occurredAt = occurredAt;
    }

    public Integer getValue() {
        return value;
    }

    public void setValue(Integer value) {
        this.value = value;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public Long getGroupId() {
        return groupId;
    }

    public void setGroupId(Long groupId) {
        this.groupId = groupId;
    }
}
