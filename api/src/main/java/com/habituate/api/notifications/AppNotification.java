package com.habituate.api.notifications;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * A persistent, in-app notification — distinct from (and sent alongside) a
 * push via ExpoPushService, which is fire-and-forget and invisible once
 * dismissed. This is the row the Community page's notification bell reads,
 * so "friend accepted your request" or "X checked in today" stays visible
 * even if the push never arrived (app was closed, permission denied, no
 * token registered yet) or was swiped away.
 *
 * groupId/challengeId/habitId are nullable, mutually-not-exclusive deep-link
 * targets — whichever ones are set tell the client which screen/detail modal
 * to open on tap. Plain nullable columns rather than a JSON payload (unlike
 * coach_messages.proposal_payload) since every notification type here only
 * ever needs at most one of these three ids, not an open-ended field set.
 */
@Entity
@Table(name = "app_notifications")
public class AppNotification {

    public static final String FRIEND_REQUEST_ACCEPTED = "FRIEND_REQUEST_ACCEPTED";
    public static final String GROUP_JOINED = "GROUP_JOINED";
    public static final String GROUP_CHECKIN = "GROUP_CHECKIN";
    public static final String GROUP_DELETED = "GROUP_DELETED";
    public static final String CHALLENGE_INVITE = "CHALLENGE_INVITE";
    public static final String CHALLENGE_CHECKIN = "CHALLENGE_CHECKIN";
    public static final String CHALLENGE_DELETED = "CHALLENGE_DELETED";
    public static final String NUDGE = "NUDGE";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private String type;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String body;

    @Column
    private Long groupId;

    @Column
    private Long challengeId;

    @Column
    private Long habitId;

    @Column(nullable = false, columnDefinition = "boolean not null default false")
    private boolean read = false;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public AppNotification() {
    }

    public AppNotification(String userId, String type, String title, String body,
                            Long groupId, Long challengeId, Long habitId) {
        this.userId = userId;
        this.type = type;
        this.title = title;
        this.body = body;
        this.groupId = groupId;
        this.challengeId = challengeId;
        this.habitId = habitId;
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

    public String getTitle() {
        return title;
    }

    public String getBody() {
        return body;
    }

    public Long getGroupId() {
        return groupId;
    }

    public Long getChallengeId() {
        return challengeId;
    }

    public Long getHabitId() {
        return habitId;
    }

    public boolean isRead() {
        return read;
    }

    public void setRead(boolean read) {
        this.read = read;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
