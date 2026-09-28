package com.habituate.api.common;

/** Thrown when a resource exists but doesn't belong to the requesting user. */
public class ForbiddenException extends RuntimeException {
    public ForbiddenException(String message) {
        super(message);
    }
}
