package com.habituate.api.groups;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * Directional (requester -> recipient), not mirrored into a reciprocal row on
 * accept — "my friends" queries check both requesterId = me OR recipientId =
 * me with status = ACCEPTED, same spirit as correlations being stored
 * directionally rather than duplicated.
 */
@Entity
@Table(name = "friendships")
public class Friendship {

    public static final String PENDING = "PENDING";
    public static final String ACCEPTED = "ACCEPTED";
    public static final String DECLINED = "DECLINED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String requesterId;

    @Column(nullable = false)
    private String recipientId;

    @Column(nullable = false, columnDefinition = "varchar(255) not null default 'PENDING'")
    private String status = PENDING;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    public Friendship() {
    }

    public Friendship(String requesterId, String recipientId) {
        this.requesterId = requesterId;
        this.recipientId = recipientId;
        this.status = PENDING;
    }

    @PrePersist
    public void prePersist() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public String getRequesterId() {
        return requesterId;
    }

    public String getRecipientId() {
        return recipientId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
