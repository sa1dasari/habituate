package com.habituate.api.groups;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;

/**
 * One member's YES/NO answer on a ChallengeEndVote. One row per
 * (voteId, userId) — a vote can't be changed once cast, same immutable-once
 * pattern CheckInCheer uses for its own unique pair. The proposer's own YES
 * is inserted automatically when the vote opens (ChallengeEndVoteService.
 * openVote) — "starting the vote is their yes" (owner decision).
 */
@Entity
@Table(name = "challenge_end_vote_responses", uniqueConstraints = @UniqueConstraint(columnNames = {"vote_id", "user_id"}))
public class ChallengeEndVoteResponse {

    public static final String YES = "YES";
    public static final String NO = "NO";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "vote_id", nullable = false)
    private Long voteId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(nullable = false)
    private String response;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public ChallengeEndVoteResponse() {
    }

    public ChallengeEndVoteResponse(Long voteId, String userId, String response) {
        this.voteId = voteId;
        this.userId = userId;
        this.response = response;
        this.createdAt = Instant.now();
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

    public String getResponse() {
        return response;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
