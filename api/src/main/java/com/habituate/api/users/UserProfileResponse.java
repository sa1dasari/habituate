package com.habituate.api.users;

import java.time.LocalDate;

public record UserProfileResponse(String timezone, LocalDate dateOfBirth) {
}
