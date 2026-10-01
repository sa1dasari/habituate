package com.habituate.api.insights;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * One directional pairwise stat: habitA -> habitB, over a rolling window.
 * Recomputed (updated in place) every nightly run rather than accumulating a
 * new row per run — see InsightService's upsert-by-natural-key pattern.
 */
@Entity
@Table(name = "correlations")
public class Correlation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private Long habitAId;

    @Column(nullable = false)
    private Long habitBId;

    @Column(nullable = false)
    private Integer windowDays;

    @Column(nullable = false)
    private Double score;

    @Column(nullable = false)
    private Integer sampleSize;

    @Column(nullable = false)
    private Instant computedAt;

    public Correlation() {
    }

    public Correlation(String userId, Long habitAId, Long habitBId, Integer windowDays,
                        Double score, Integer sampleSize, Instant computedAt) {
        this.userId = userId;
        this.habitAId = habitAId;
        this.habitBId = habitBId;
        this.windowDays = windowDays;
        this.score = score;
        this.sampleSize = sampleSize;
        this.computedAt = computedAt;
    }

    public Long getId() {
        return id;
    }

    public String getUserId() {
        return userId;
    }

    public Long getHabitAId() {
        return habitAId;
    }

    public Long getHabitBId() {
        return habitBId;
    }

    public Integer getWindowDays() {
        return windowDays;
    }

    public Double getScore() {
        return score;
    }

    public void setScore(Double score) {
        this.score = score;
    }

    public Integer getSampleSize() {
        return sampleSize;
    }

    public void setSampleSize(Integer sampleSize) {
        this.sampleSize = sampleSize;
    }

    public Instant getComputedAt() {
        return computedAt;
    }

    public void setComputedAt(Instant computedAt) {
        this.computedAt = computedAt;
    }
}
