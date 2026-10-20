package com.habituate.api.notifications;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Persistent counterpart to ExpoPushService's fire-and-forget push — every
 * caller here is expected to be a best-effort side effect of some other
 * action (a friend request accepted, a shared habit checked in, a nudge
 * sent), so `notify` never throws: a notification-write failure must never
 * roll back or fail the primary action that triggered it, same convention as
 * FirebaseAuthFilter's recordTimezoneQuietly.
 */
@Service
public class AppNotificationService {

    private static final Logger log = LoggerFactory.getLogger(AppNotificationService.class);

    private final AppNotificationRepository repository;

    public AppNotificationService(AppNotificationRepository repository) {
        this.repository = repository;
    }

    public void notify(String userId, String type, String title, String body,
                        Long groupId, Long challengeId, Long habitId) {
        try {
            repository.save(new AppNotification(userId, type, title, body, groupId, challengeId, habitId));
        } catch (Exception e) {
            log.warn("Could not create notification ({}) for {}: {}", type, userId, e.getMessage());
        }
    }

    /** Fans the same notification out to several recipients at once (e.g. every other
     * active member of a shared habit) — still best-effort per recipient. */
    public void notifyAll(List<String> userIds, String type, String title, String body,
                           Long groupId, Long challengeId, Long habitId) {
        for (String userId : userIds) {
            notify(userId, type, title, body, groupId, challengeId, habitId);
        }
    }

    public List<AppNotificationResponse> listRecent(String userId) {
        return repository.findTop50ByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    public long unreadCount(String userId) {
        return repository.countByUserIdAndReadFalse(userId);
    }

    @Transactional
    public void markRead(String userId, Long notificationId) {
        repository.findById(notificationId)
                .filter(n -> n.getUserId().equals(userId))
                .ifPresent(n -> {
                    n.setRead(true);
                    repository.save(n);
                });
    }

    @Transactional
    public void delete(String userId, Long notificationId) {
        repository.findById(notificationId)
                .filter(n -> n.getUserId().equals(userId))
                .ifPresent(repository::delete);
    }

    @Transactional
    public void markAllRead(String userId) {
        repository.findByUserIdAndReadFalse(userId).forEach(n -> {
            n.setRead(true);
            repository.save(n);
        });
    }

    private AppNotificationResponse toResponse(AppNotification n) {
        return new AppNotificationResponse(n.getId(), n.getType(), n.getTitle(), n.getBody(),
                n.getGroupId(), n.getChallengeId(), n.getHabitId(), n.isRead(), n.getCreatedAt());
    }
}
