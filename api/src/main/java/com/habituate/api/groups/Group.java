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
@Table(name = "groups")
public class Group {

    public static final String ALL_MEMBERS = "ALL_MEMBERS";
    public static final String ANY_MEMBER = "ANY_MEMBER";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String createdBy;

    @Column(nullable = false)
    private String streakRule;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public Group() {
    }

    public Group(String name, String createdBy, String streakRule) {
        this.name = name;
        this.createdBy = createdBy;
        this.streakRule = streakRule;
    }

    @PrePersist
    public void prePersist() {
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public String getStreakRule() {
        return streakRule;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
