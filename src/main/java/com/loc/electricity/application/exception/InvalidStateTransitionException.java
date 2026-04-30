package com.loc.electricity.application.exception;

import org.springframework.http.HttpStatus;

public class InvalidStateTransitionException extends BusinessException {

    public InvalidStateTransitionException(String message) {
        super("INVALID_STATE_TRANSITION", message, HttpStatus.UNPROCESSABLE_ENTITY);
    }
}
