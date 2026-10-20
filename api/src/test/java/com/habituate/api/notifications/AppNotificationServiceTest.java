package com.habituate.api.notifications;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class AppNotificationServiceTest {

    private static final List<String> TEST_USER_IDS = List.of(
            "notification-test-user-1", "notification-test-user-2", "notification-test-user-2b",
            "notification-test-user-3", "notification-test-user-3b",
            "notification-test-user-4", "notification-test-user-4b");

    @Autowired
    private AppNotificationService appNotificationService;

    @Autowired
    private AppNotificationRepository appNotificationRepository;

    private String userId;

    // deleteByUserId is a derived bulk-delete query and needs a surrounding transaction (unlike
    // the single-entity deleteById inherited from CrudRepository, which is already
    // @Transactional) — fetch-then-deleteById avoids adding @Transactional just for test cleanup.
    private void deleteAllFor(String targetUserId) {
        appNotificationRepository.findTop50ByUserIdOrderByCreatedAtDesc(targetUserId)
                .forEach(n -> appNotificationRepository.deleteById(n.getId()));
    }

    // Guards against stale rows surviving a previous run that failed mid-cleanup (every assertion
    // below counts exact rows for a userId, so any leftover row makes the count wrong).
    @BeforeEach
    void cleanBeforeEach() {
        TEST_USER_IDS.forEach(this::deleteAllFor);
    }

    @AfterEach
    void cleanup() {
        if (userId != null) {
            deleteAllFor(userId);
        }
    }

    @Test
    void notify_persistsNotification_visibleInListRecentAndUnreadCount() {
        userId = "notification-test-user-1";

        appNotificationService.notify(userId, AppNotification.NUDGE, "Nudge",
                "A friend nudged you", null, null, null);

        List<AppNotificationResponse> recent = appNotificationService.listRecent(userId);
        assertThat(recent).hasSize(1);
        assertThat(recent.get(0).type()).isEqualTo(AppNotification.NUDGE);
        assertThat(recent.get(0).title()).isEqualTo("Nudge");
        assertThat(recent.get(0).read()).isFalse();
        assertThat(appNotificationService.unreadCount(userId)).isEqualTo(1);
    }

    @Test
    void notifyAll_fansOutToEveryRecipient() {
        userId = "notification-test-user-2";
        String otherUserId = "notification-test-user-2b";

        try {
            appNotificationService.notifyAll(List.of(userId, otherUserId), AppNotification.GROUP_CHECKIN,
                    "Check-in", "Someone checked in", 1L, null, null);

            assertThat(appNotificationService.listRecent(userId)).hasSize(1);
            assertThat(appNotificationService.listRecent(otherUserId)).hasSize(1);
        } finally {
            deleteAllFor(otherUserId);
        }
    }

    @Test
    void markRead_onlyAffectsOwnNotification() {
        userId = "notification-test-user-3";
        String otherUserId = "notification-test-user-3b";

        try {
            appNotificationService.notify(userId, AppNotification.NUDGE, "Nudge", "Body", null, null, null);
            appNotificationService.notify(otherUserId, AppNotification.NUDGE, "Nudge", "Body", null, null, null);

            Long notificationId = appNotificationService.listRecent(userId).get(0).id();
            Long otherNotificationId = appNotificationService.listRecent(otherUserId).get(0).id();

            // Attempting to mark someone else's notification as read must be a no-op.
            appNotificationService.markRead(userId, otherNotificationId);
            assertThat(appNotificationService.unreadCount(otherUserId)).isEqualTo(1);

            appNotificationService.markRead(userId, notificationId);
            assertThat(appNotificationService.unreadCount(userId)).isEqualTo(0);
        } finally {
            deleteAllFor(otherUserId);
        }
    }

    @Test
    void delete_onlyAffectsOwnNotification() {
        userId = "notification-test-user-4";
        String otherUserId = "notification-test-user-4b";

        try {
            appNotificationService.notify(userId, AppNotification.NUDGE, "Nudge", "Body", null, null, null);
            appNotificationService.notify(otherUserId, AppNotification.NUDGE, "Nudge", "Body", null, null, null);

            Long notificationId = appNotificationService.listRecent(userId).get(0).id();
            Long otherNotificationId = appNotificationService.listRecent(otherUserId).get(0).id();

            // Attempting to delete someone else's notification must be a silent no-op.
            appNotificationService.delete(userId, otherNotificationId);
            assertThat(appNotificationService.listRecent(otherUserId)).hasSize(1);

            appNotificationService.delete(userId, notificationId);
            assertThat(appNotificationService.listRecent(userId)).isEmpty();
        } finally {
            deleteAllFor(otherUserId);
        }
    }

    @Test
    void markAllRead_clearsUnreadCount() {
        userId = "notification-test-user-4";

        appNotificationService.notify(userId, AppNotification.NUDGE, "Nudge 1", "Body", null, null, null);
        appNotificationService.notify(userId, AppNotification.NUDGE, "Nudge 2", "Body", null, null, null);
        assertThat(appNotificationService.unreadCount(userId)).isEqualTo(2);

        appNotificationService.markAllRead(userId);

        assertThat(appNotificationService.unreadCount(userId)).isEqualTo(0);
    }
}
