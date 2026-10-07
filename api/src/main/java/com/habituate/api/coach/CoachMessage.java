package com.habituate.api.coach;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * One turn in a user's persistent Ask Habituate conversation (Phase 10 — one
 * continuous thread per user, not multiple named conversations). An ASSISTANT
 * message optionally carries ONE proposed action — proposalType discriminates
 * which: ADJUST_HABIT (change an existing habit's target, fields on this row
 * via habitId/adjustmentField/adjustmentCurrentValue/adjustmentNewValue) or
 * CREATE_HABIT (a brand-new habit, its fields serialized as JSON into
 * proposalPayload rather than given their own columns, since a creation
 * carries a different field set than an adjustment and this avoids a pile of
 * columns that are null for every row of the other type). adjustmentTitle/
 * adjustmentDescription/adjustmentStatus are shared card copy + lifecycle
 * state for BOTH proposal types despite the "adjustment" name (kept to avoid
 * a column rename migration) — confirmed or rejected via CoachService, and
 * NEVER applied automatically: status starts PENDING and the habit is only
 * ever created/mutated from CoachService.confirmProposal().
 */
@Entity
@Table(name = "coach_messages")
public class CoachMessage {

    public static final String ROLE_USER = "USER";
    public static final String ROLE_ASSISTANT = "ASSISTANT";

    public static final String ADJUSTMENT_PENDING = "PENDING";
    public static final String ADJUSTMENT_CONFIRMED = "CONFIRMED";
    public static final String ADJUSTMENT_REJECTED = "REJECTED";

    public static final String PROPOSAL_ADJUST_HABIT = "ADJUST_HABIT";
    public static final String PROPOSAL_CREATE_HABIT = "CREATE_HABIT";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private String role;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    /** The habit this message is grounded in / the adjustment targets — set on CREATE_HABIT confirm too, to the newly created habit. */
    private Long habitId;

    /** Discriminates ADJUST_HABIT vs CREATE_HABIT; null for a plain text-only reply with no proposal. */
    private String proposalType;

    /** CREATE_HABIT only — JSON-serialized {name, category, cadenceTarget, weeklyTarget, monthlyTarget, trackingMode}. */
    @Column(columnDefinition = "TEXT")
    private String proposalPayload;

    private String adjustmentField;

    private Integer adjustmentCurrentValue;

    private Integer adjustmentNewValue;

    private String adjustmentTitle;

    @Column(columnDefinition = "TEXT")
    private String adjustmentDescription;

    private String adjustmentStatus;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public CoachMessage() {
    }

    public CoachMessage(String userId, String role, String content) {
        this.userId = userId;
        this.role = role;
        this.content = content;
    }

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Long getId() {
        return id;
    }

    public String getUserId() {
        return userId;
    }

    public String getRole() {
        return role;
    }

    public String getContent() {
        return content;
    }

    public Long getHabitId() {
        return habitId;
    }

    public void setHabitId(Long habitId) {
        this.habitId = habitId;
    }

    public String getProposalType() {
        return proposalType;
    }

    public void setProposalType(String proposalType) {
        this.proposalType = proposalType;
    }

    public String getProposalPayload() {
        return proposalPayload;
    }

    public void setProposalPayload(String proposalPayload) {
        this.proposalPayload = proposalPayload;
    }

    public String getAdjustmentField() {
        return adjustmentField;
    }

    public void setAdjustmentField(String adjustmentField) {
        this.adjustmentField = adjustmentField;
    }

    public Integer getAdjustmentCurrentValue() {
        return adjustmentCurrentValue;
    }

    public void setAdjustmentCurrentValue(Integer adjustmentCurrentValue) {
        this.adjustmentCurrentValue = adjustmentCurrentValue;
    }

    public Integer getAdjustmentNewValue() {
        return adjustmentNewValue;
    }

    public void setAdjustmentNewValue(Integer adjustmentNewValue) {
        this.adjustmentNewValue = adjustmentNewValue;
    }

    public String getAdjustmentTitle() {
        return adjustmentTitle;
    }

    public void setAdjustmentTitle(String adjustmentTitle) {
        this.adjustmentTitle = adjustmentTitle;
    }

    public String getAdjustmentDescription() {
        return adjustmentDescription;
    }

    public void setAdjustmentDescription(String adjustmentDescription) {
        this.adjustmentDescription = adjustmentDescription;
    }

    public String getAdjustmentStatus() {
        return adjustmentStatus;
    }

    public void setAdjustmentStatus(String adjustmentStatus) {
        this.adjustmentStatus = adjustmentStatus;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
