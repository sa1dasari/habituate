package com.habituate.api.groups;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * An "end early" vote on a Challenge that already reached its target —
 * ChallengeEndVoteService.openVote. The eligible voter set is snapshotted
 * into ChallengeEndVoteVoter at open time (owner decision: a later joiner
 * can't vote; someone who leaves still counts in the total until the vote
 * closes), so this row alone can't answer "who can vote" — join the voter
 * table for that.
 *
 * outcome is null while open, "PASSED" or "FAILED" once resolved — either
 * immediately in ChallengeEndVoteService.respond (majority reached) or by
 * ChallengeEndVoteCloseScheduler at closesAt (no majority within 24h).
 * resolvedAt is separate from closesAt because a vote can resolve early;
 * the 24-hour "a new vote can start 24 hours after the last one closed"
 * cooldown is measured from resolvedAt, not the original closesAt deadline.
 */
@Entity
@Table(name = "challenge_end_votes")
public class ChallengeEndVote {

    public static final String PASSED = "PASSED";
    public static final String FAILED = "FAILED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long challengeId;

    @Column(nullable = false)
    private String proposedBy;

    @Column(nullable = false, updatable = false)
    private Instant openedAt;

    @Column(nullable = false)
    private Instant closesAt;

    @Column
    private String outcome;

    @Column
    private Instant resolvedAt;

    public ChallengeEndVote() {
    }

    public ChallengeEndVote(Long challengeId, String proposedBy, Instant openedAt, Instant closesAt) {
        this.challengeId = challengeId;
        this.proposedBy = proposedBy;
        this.openedAt = openedAt;
        this.closesAt = closesAt;
    }

    public Long getId() {
        return id;
    }

    public Long getChallengeId() {
        return challengeId;
    }

    public String getProposedBy() {
        return proposedBy;
    }

    public Instant getOpenedAt() {
        return openedAt;
    }

    public Instant getClosesAt() {
        return closesAt;
    }

    public String getOutcome() {
        return outcome;
    }

    public void setOutcome(String outcome) {
        this.outcome = outcome;
    }

    public Instant getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(Instant resolvedAt) {
        this.resolvedAt = resolvedAt;
    }
}
