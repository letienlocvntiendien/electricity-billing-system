package com.loc.electricity.application.exception;

import org.springframework.http.HttpStatus;

public class PeriodLockedException extends BusinessException {

    public PeriodLockedException(String message) {
        super("PERIOD_LOCKED", message, HttpStatus.CONFLICT);
    }
}
