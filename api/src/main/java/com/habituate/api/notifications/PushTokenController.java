package com.habituate.api.notifications;

import com.habituate.api.config.FirebaseAuthFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/push-tokens")
public class PushTokenController {

    private final PushTokenService pushTokenService;

    public PushTokenController(PushTokenService pushTokenService) {
        this.pushTokenService = pushTokenService;
    }

    private String userId(HttpServletRequest req) {
        return (String) req.getAttribute(FirebaseAuthFilter.USER_ID_ATTRIBUTE);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void register(HttpServletRequest req, @RequestBody RegisterPushTokenRequest request) {
        pushTokenService.register(userId(req), request.token(), request.platform());
    }

    /** Called on sign-out so a shared/reset device stops receiving this account's reminders. */
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unregister(@RequestBody RegisterPushTokenRequest request) {
        pushTokenService.unregister(request.token());
    }
}
