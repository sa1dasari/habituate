package com.habituate.api.groups;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "challenge_participants")
public class ChallengeParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long challengeId;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private Integer progressCount = 0;

    @Column(nullable = false, updatable = false)
    private Instant joinedAt;

    public ChallengeParticipant() {
    }

    public ChallengeParticipant(Long challengeId, String userId) {
        this.challengeId = challengeId;
        this.userId = userId;
        this.progressCount = 0;
    }

    @PrePersist
    public void prePersist() {
        this.joinedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Long getChallengeId() {
        return challengeId;
    }

    public String getUserId() {
        return userId;
    }

    public Integer getProgressCount() {
        return progressCount;
    }

    public void setProgressCount(Integer progressCount) {
        this.progressCount = progressCount;
    }

    public Instant getJoinedAt() {
        return joinedAt;
    }
}
