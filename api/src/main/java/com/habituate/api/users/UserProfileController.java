package com.habituate.api.users;

import com.habituate.api.config.FirebaseAuthFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserProfileController {

    private final UserProfileService userProfileService;

    public UserProfileController(UserProfileService userProfileService) {
        this.userProfileService = userProfileService;
    }

    private String userId(HttpServletRequest req) {
        return (String) req.getAttribute(FirebaseAuthFilter.USER_ID_ATTRIBUTE);
    }

    @GetMapping("/me")
    public UserProfileResponse getProfile(HttpServletRequest req) {
        return userProfileService.getProfile(userId(req));
    }

    @PatchMapping("/me")
    public UserProfileResponse updateProfile(HttpServletRequest req, @RequestBody UpdateUserProfileRequest request) {
        return userProfileService.updateProfile(userId(req), request);
    }

    @DeleteMapping("/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAccount(HttpServletRequest req) {
        userProfileService.deleteAccount(userId(req));
    }

    @GetMapping("/username/available")
    public UsernameAvailabilityResponse checkUsernameAvailable(@RequestParam("value") String value) {
        return new UsernameAvailabilityResponse(userProfileService.isUsernameAvailable(value));
    }

    @PatchMapping("/username")
    public UserProfileResponse setUsername(HttpServletRequest req, @RequestBody SetUsernameRequest request) {
        return userProfileService.setUsername(userId(req), request.username());
    }

    @GetMapping("/search")
    public List<UserSearchResult> search(HttpServletRequest req, @RequestParam("q") String query) {
        return userProfileService.searchByUsername(userId(req), query);
    }
}
