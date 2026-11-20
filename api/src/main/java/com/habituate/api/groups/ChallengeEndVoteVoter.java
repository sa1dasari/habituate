package com.habituate.api.groups;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * Snapshot of who was an active participant when a ChallengeEndVote opened —
 * the full "eligible to vote" set for that vote, fixed at open time
 * regardless of later joins/leaves. See ChallengeEndVote's own javadoc for
 * why this needs to be a separate table rather than a live
 * ChallengeParticipantRepository query at vote-close time.
 */
@Entity
@Table(name = "challenge_end_vote_voters", uniqueConstraints = @UniqueConstraint(columnNames = {"vote_id", "user_id"}))
public class ChallengeEndVoteVoter {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "vote_id", nullable = false)
    private Long voteId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    public ChallengeEndVoteVoter() {
    }

    public ChallengeEndVoteVoter(Long voteId, String userId) {
        this.voteId = voteId;
        this.userId = userId;
    }

    public Long getId() {
        return id;
    }

    public Long getVoteId() {
        return voteId;
    }

    public String getUserId() {
        return userId;
    }
}
