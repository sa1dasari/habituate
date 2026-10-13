package com.habituate.api.users;

/** Each field is "YYYY-MM-DD"/free text, or null/blank to clear it — the client always sends its current values on save. */
public record UpdateUserProfileRequest(String dateOfBirth, String phoneNumber, String address, String gender) {
}
