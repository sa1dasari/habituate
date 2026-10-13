package com.habituate.api.feedback;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** A user-submitted bug report or feature suggestion from the Account Settings "Report a Bug/Suggestion" page. */
@Entity
@Table(name = "feedback")
public class Feedback {

    public static final String BUG = "BUG";
    public static final String SUGGESTION = "SUGGESTION";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private String type;

    /** Which app screen the report is about — free text (e.g. "Habits", "Community"), not a fixed enum. */
    @Column
    private String page;

    @Column(nullable = false, columnDefinition = "text")
    private String message;

    @Column(columnDefinition = "text")
    private String stepsToReproduce;

    @Column
    private String appVersion;

    @Column
    private String platform;

    /** Firebase Storage download URLs — the mobile app uploads attachments directly to Storage (same
     * pattern as the profile-photo upload) and only sends the resulting URLs here. */
    @ElementCollection
    @CollectionTable(name = "feedback_attachments", joinColumns = @JoinColumn(name = "feedback_id"))
    @Column(name = "url")
    private List<String> attachmentUrls = new ArrayList<>();

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public Feedback() {
    }

    public Feedback(String userId, String type, String page, String message, String stepsToReproduce,
                     List<String> attachmentUrls, String appVersion, String platform) {
        this.userId = userId;
        this.type = type;
        this.page = page;
        this.message = message;
        this.stepsToReproduce = stepsToReproduce;
        if (attachmentUrls != null) {
            this.attachmentUrls = new ArrayList<>(attachmentUrls);
        }
        this.appVersion = appVersion;
        this.platform = platform;
    }

    @PrePersist
    public void prePersist() {
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public String getUserId() {
        return userId;
    }

    public String getType() {
        return type;
    }

    public String getPage() {
        return page;
    }

    public String getMessage() {
        return message;
    }

    public String getStepsToReproduce() {
        return stepsToReproduce;
    }

    public String getAppVersion() {
        return appVersion;
    }

    public String getPlatform() {
        return platform;
    }

    public List<String> getAttachmentUrls() {
        return attachmentUrls;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
