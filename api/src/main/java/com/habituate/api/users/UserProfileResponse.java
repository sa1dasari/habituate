package com.habituate.api.users;

import java.time.LocalDate;

/** username is null until the user has chosen one — the mobile app treats that as "must
 * complete setup" and blocks entry past a username-picker screen. profileVisibility is
 * "PUBLIC" or "PRIVATE" — see User.getProfileVisibility(), never null even for a row
 * predating the column. */
public record UserProfileResponse(
        String timezone,
        LocalDate dateOfBirth,
        String phoneNumber,
        String address,
        String gender,
        String username,
        String profileVisibility) {
}
