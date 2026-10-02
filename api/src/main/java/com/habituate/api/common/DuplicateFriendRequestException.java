package com.habituate.api.common;

/** Thrown when a friendship (pending or accepted) already exists between two users, either direction. */
public class DuplicateFriendRequestException extends RuntimeException {
    public DuplicateFriendRequestException(String message) {
        super(message);
    }
}
