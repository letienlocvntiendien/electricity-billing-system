package com.loc.electricity.application.service;

import com.loc.electricity.application.exception.InvalidStateTransitionException;
import com.loc.electricity.application.exception.PeriodLockedException;
import com.loc.electricity.domain.period.BillingPeriod;
import com.loc.electricity.domain.period.PeriodStatus;
import org.springframework.stereotype.Component;

@Component
public class PeriodWriteGuard {

    public void assertWritable(BillingPeriod period) {
        if (period.getStatus() == PeriodStatus.APPROVED || period.getStatus() == PeriodStatus.CLOSED) {
            throw new PeriodLockedException(
                    "Period '" + period.getCode() + "' is locked (status=" + period.getStatus() + ")");
        }
    }

    public void assertStatus(BillingPeriod period, PeriodStatus required) {
        if (period.getStatus() != required) {
            throw new InvalidStateTransitionException(
                    "Period '" + period.getCode() + "': expected status " + required
                            + " but current status is " + period.getStatus());
        }
    }
}
