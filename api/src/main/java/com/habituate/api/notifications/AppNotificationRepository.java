package com.habituate.api.notifications;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AppNotificationRepository extends JpaRepository<AppNotification, Long> {
    List<AppNotification> findTop50ByUserIdOrderByCreatedAtDesc(String userId);

    List<AppNotification> findByUserIdAndReadFalse(String userId);

    long countByUserIdAndReadFalse(String userId);

    void deleteByUserId(String userId);
}
