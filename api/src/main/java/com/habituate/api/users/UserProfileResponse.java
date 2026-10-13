package com.habituate.api.users;

import java.time.LocalDate;

public record UserProfileResponse(
        String timezone,
        LocalDate dateOfBirth,
        String phoneNumber,
        String address,
        String gender) {
}
