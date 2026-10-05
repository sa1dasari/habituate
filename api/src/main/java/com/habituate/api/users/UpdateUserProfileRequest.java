package com.habituate.api.users;

/** dateOfBirth as "YYYY-MM-DD", or null/blank to clear it. */
public record UpdateUserProfileRequest(String dateOfBirth) {
}
