package com.habituate.api.users;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;

/**
 * User-facing profile fields that don't belong in Firebase Auth (which only
 * covers displayName/photoURL/email) — dateOfBirth today, the same users row
 * UserTimezoneService writes to opportunistically. Kept as a separate service
 * since this one is a real user-facing endpoint (UserProfileController), not
 * a side effect of request handling.
 */
@Service
public class UserProfileService {

    private static final int MAX_AGE_YEARS = 130;

    private final UserRepository userRepository;

    public UserProfileService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public UserProfileResponse getProfile(String userId) {
        return userRepository.findById(userId)
                .map(u -> new UserProfileResponse(u.getTimezone(), u.getDateOfBirth()))
                .orElse(new UserProfileResponse(null, null));
    }

    @Transactional
    public UserProfileResponse updateDateOfBirth(String userId, String dateOfBirthValue) {
        LocalDate dateOfBirth = parseDateOfBirth(dateOfBirthValue);

        User user = userRepository.findById(userId).orElseGet(() -> new User(userId, null));
        user.setDateOfBirth(dateOfBirth);
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);

        return new UserProfileResponse(user.getTimezone(), user.getDateOfBirth());
    }

    private LocalDate parseDateOfBirth(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        LocalDate date;
        try {
            date = LocalDate.parse(value.trim());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Invalid dateOfBirth, expected YYYY-MM-DD: " + value);
        }
        LocalDate today = LocalDate.now();
        if (date.isAfter(today)) {
            throw new IllegalArgumentException("dateOfBirth cannot be in the future: " + date);
        }
        if (date.isBefore(today.minusYears(MAX_AGE_YEARS))) {
            throw new IllegalArgumentException("dateOfBirth is implausibly far in the past: " + date);
        }
        return date;
    }
}
