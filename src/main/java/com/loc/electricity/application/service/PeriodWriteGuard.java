package com.loc.electricity.application.service;

import com.loc.electricity.application.exception.InvalidStateTransitionException;
import com.loc.electricity.application.exception.PeriodLockedException;
import com.loc.electricity.domain.period.BillingPeriod;
import com.loc.electricity.domain.period.PeriodStatus;
import org.springframework.stereotype.Component;
/**
 * Guards billing period mutations by enforcing status preconditions.
 * Injected into services that modify period-related data to centralize lock checks.
 */
@Component
public class PeriodWriteGuard {

    /**
     * Asserts that the period allows data modifications.
     * Periods in APPROVED or CLOSED status are considered locked.
     *
     * @param period the period to check
     * @throws com.loc.electricity.application.exception.PeriodLockedException if the period is APPROVED or CLOSED
     */
    public void assertWritable(BillingPeriod period) {
        if (period.getStatus() == PeriodStatus.APPROVED || period.getStatus() == PeriodStatus.CLOSED) {
            throw new PeriodLockedException(
                    "Period '" + period.getCode() + "' is locked (status=" + period.getStatus() + ")");
        }
    }

    /**
     * Asserts that the period is in the required status for a state machine transition.
     *
     * @param period   the period to check
     * @param required the expected status
     * @throws com.loc.electricity.application.exception.InvalidStateTransitionException if the period's status does not match
     */
    public void assertStatus(BillingPeriod period, PeriodStatus required) {
        if (period.getStatus() != required) {
            throw new InvalidStateTransitionException(
                    "Period '" + period.getCode() + "': expected status " + required
                            + " but current status is " + period.getStatus());
        }
    }
}
