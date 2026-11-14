package com.habituate.api.habits;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * One tower "segment" for a daily-cadence habit (SKYLINE.md section 6). A
 * habit has one open segment at a time (toppedOutAt null) plus zero or more
 * closed ones from past top-outs. Topping out closes the current segment
 * (stamping toppedOutAt and freezing its best run) and opens a fresh one —
 * the run itself is untouched; only the segment boundary moves. There's no
 * backfill migration for habits created before this table existed:
 * HabitTowerService lazily creates the first open segment (started_at =
 * habit.createdAt) the first time one is needed.
 */
@Entity
@Table(name = "habit_towers")
public class HabitTower {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long habitId;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private Instant startedAt;

    /** Null while this segment is the current, active one. */
    @Column
    private Instant toppedOutAt;

    /** Snapshot of the best run reached inside this segment's own window,
     * taken at top-out time. Null while the segment is still open — the
     * live best run for an open segment is whatever StreakCalculator
     * computes on demand, not stored here. */
    @Column
    private Integer bestRunInSegment;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public HabitTower() {
    }

    public HabitTower(Long habitId, String userId, Instant startedAt) {
        this.habitId = habitId;
        this.userId = userId;
        this.startedAt = startedAt;
    }

    @PrePersist
    public void prePersist() {
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Long getHabitId() {
        return habitId;
    }

    public String getUserId() {
        return userId;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public Instant getToppedOutAt() {
        return toppedOutAt;
    }

    public void setToppedOutAt(Instant toppedOutAt) {
        this.toppedOutAt = toppedOutAt;
    }

    public Integer getBestRunInSegment() {
        return bestRunInSegment;
    }

    public void setBestRunInSegment(Integer bestRunInSegment) {
        this.bestRunInSegment = bestRunInSegment;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
