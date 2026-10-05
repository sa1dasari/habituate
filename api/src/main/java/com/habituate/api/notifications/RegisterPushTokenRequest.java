package com.habituate.api.notifications;

/** platform: "ios" or "android", informational only. */
public record RegisterPushTokenRequest(String token, String platform) {
}
