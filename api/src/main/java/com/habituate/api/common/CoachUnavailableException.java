package com.habituate.api.common;

/** Ask Habituate couldn't reach the Anthropic API, or no API key is configured. */
public class CoachUnavailableException extends RuntimeException {
    public CoachUnavailableException(String message) {
        super(message);
    }
}
