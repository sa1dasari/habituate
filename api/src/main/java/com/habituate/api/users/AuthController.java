package com.habituate.api.users;

import jakarta.persistence.EntityNotFoundException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Deliberately public (see FirebaseAuthFilter.shouldNotFilter) — the login screen needs this
 * before the user has a token, to let "username or email" sign-in resolve a typed username
 * into the email Firebase's own signInWithEmailAndPassword call requires. */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserProfileService userProfileService;

    public AuthController(UserProfileService userProfileService) {
        this.userProfileService = userProfileService;
    }

    @GetMapping("/username-email")
    public Map<String, String> usernameToEmail(@RequestParam("username") String username) {
        String email = userProfileService.resolveEmailForUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("No account found for username: " + username));
        return Map.of("email", email);
    }
}
