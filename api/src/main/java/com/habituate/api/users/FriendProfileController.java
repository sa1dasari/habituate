package com.habituate.api.users;

import com.habituate.api.config.FirebaseAuthFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Separate from UserProfileController (which is scoped to the authenticated caller's own
 * profile only, per CLAUDE.md) — this is the one cross-user read in the users package, and
 * it's friendship-gated inside FriendProfileService rather than open to any userId.
 */
@RestController
@RequestMapping("/api/users")
public class FriendProfileController {

    private final FriendProfileService friendProfileService;

    public FriendProfileController(FriendProfileService friendProfileService) {
        this.friendProfileService = friendProfileService;
    }

    private String userId(HttpServletRequest req) {
        return (String) req.getAttribute(FirebaseAuthFilter.USER_ID_ATTRIBUTE);
    }

    @GetMapping("/{userId}/profile")
    public FriendProfileResponse getFriendProfile(HttpServletRequest req, @PathVariable("userId") String targetUserId) {
        return friendProfileService.getProfile(userId(req), targetUserId);
    }
}
