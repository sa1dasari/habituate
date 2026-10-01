package com.habituate.api.insights;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

/**
 * A user-facing surfaced pattern. habitAId/habitBId are stored as real
 * columns (not just inside payload) so the service can look up "is there
 * already an insight for this exact pair" without querying inside jsonb.
 * payload carries the display copy (names, match %, description, nudge) —
 * per CLAUDE.md, kept separate from the raw stat in `correlations` so copy
 * can be revised without recomputing the underlying score.
 */
@Entity
@Table(name = "insights")
public class Insight {

    public static final String TYPE_CORRELATION = "correlation";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private String type;

    @Column
    private Long habitAId;

    @Column
    private Long habitBId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private String payload;

    @Column(nullable = false)
    private Instant generatedAt;

    @Column
    private Instant dismissedAt;

    public Long getId() {
        return id;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public Long getHabitAId() {
        return habitAId;
    }

    public void setHabitAId(Long habitAId) {
        this.habitAId = habitAId;
    }

    public Long getHabitBId() {
        return habitBId;
    }

    public void setHabitBId(Long habitBId) {
        this.habitBId = habitBId;
    }

    public String getPayload() {
        return payload;
    }

    public void setPayload(String payload) {
        this.payload = payload;
    }

    public Instant getGeneratedAt() {
        return generatedAt;
    }

    public void setGeneratedAt(Instant generatedAt) {
        this.generatedAt = generatedAt;
    }

    public Instant getDismissedAt() {
        return dismissedAt;
    }

    public void setDismissedAt(Instant dismissedAt) {
        this.dismissedAt = dismissedAt;
    }
}
