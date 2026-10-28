package com.habituate.api.users;

/** "PUBLIC" or "PRIVATE" (case-insensitive) — the Account Settings → Privacy toggle. A
 * dedicated endpoint rather than folding this into UpdateUserProfileRequest: that request's
 * convention is "client always sends every field's current value on save" for the full
 * EditProfileModal form, which this toggle isn't part of. */
public record UpdateProfileVisibilityRequest(String profileVisibility) {
}
