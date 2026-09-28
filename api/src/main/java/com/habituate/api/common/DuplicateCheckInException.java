package com.habituate.api.common;

/** Thrown when a second BOOLEAN check-in is attempted on a day already checked in. */
public class DuplicateCheckInException extends RuntimeException {
    public DuplicateCheckInException(String message) {
        super(message);
    }
}
