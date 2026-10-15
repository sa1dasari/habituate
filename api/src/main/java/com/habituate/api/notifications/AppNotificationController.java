package com.habituate.api.notifications;

import com.habituate.api.config.FirebaseAuthFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
public class AppNotificationController {

    private final AppNotificationService appNotificationService;

    public AppNotificationController(AppNotificationService appNotificationService) {
        this.appNotificationService = appNotificationService;
    }

    private String userId(HttpServletRequest req) {
        return (String) req.getAttribute(FirebaseAuthFilter.USER_ID_ATTRIBUTE);
    }

    @GetMapping
    public List<AppNotificationResponse> listRecent(HttpServletRequest req) {
        return appNotificationService.listRecent(userId(req));
    }

    @GetMapping("/unread-count")
    public Map<String, Long> unreadCount(HttpServletRequest req) {
        return Map.of("count", appNotificationService.unreadCount(userId(req)));
    }

    @PostMapping("/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markRead(HttpServletRequest req, @PathVariable Long id) {
        appNotificationService.markRead(userId(req), id);
    }

    @PostMapping("/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markAllRead(HttpServletRequest req) {
        appNotificationService.markAllRead(userId(req));
    }
}
