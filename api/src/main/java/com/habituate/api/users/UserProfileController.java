package com.habituate.api.users;

import com.habituate.api.config.FirebaseAuthFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users/me")
public class UserProfileController {

    private final UserProfileService userProfileService;

    public UserProfileController(UserProfileService userProfileService) {
        this.userProfileService = userProfileService;
    }

    private String userId(HttpServletRequest req) {
        return (String) req.getAttribute(FirebaseAuthFilter.USER_ID_ATTRIBUTE);
    }

    @GetMapping
    public UserProfileResponse getProfile(HttpServletRequest req) {
        return userProfileService.getProfile(userId(req));
    }

    @PatchMapping
    public UserProfileResponse updateProfile(HttpServletRequest req, @RequestBody UpdateUserProfileRequest request) {
        return userProfileService.updateDateOfBirth(userId(req), request.dateOfBirth());
    }
}
