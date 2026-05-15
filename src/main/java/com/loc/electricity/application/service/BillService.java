package com.loc.electricity.application.service;

import com.loc.electricity.application.exception.BusinessException;
import com.loc.electricity.application.exception.ResourceNotFoundException;
import com.loc.electricity.domain.bill.Bill;
import com.loc.electricity.domain.bill.BillStatus;
import com.loc.electricity.domain.period.PeriodStatus;
import com.loc.electricity.domain.user.User;
import com.loc.electricity.infrastructure.persistence.BillRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Provides read and state-mutation operations on individual bills.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BillService {

    private final BillRepository billRepository;

    /**
     * Returns all bills for the given billing period.
     *
     * @param periodId the billing period ID
     * @return list of bills, unordered
     */
    public List<Bill> findByPeriodId(Long periodId) {
        return billRepository.findAllByPeriodId(periodId);
    }
    /**
     * Finds a bill by ID.
     *
     * @param id the bill ID
     * @return the bill
     * @throws com.loc.electricity.application.exception.ResourceNotFoundException if not found
     */
    public Bill findById(Long id) {
        return billRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bill", id));
    }

    /**
     * Marks a bill as sent via Zalo. Sets {@code sentAt} to now and advances
     * status from PENDING to SENT if not already progressed further.
     * The bill's period must not be in OPEN status.
     *
     * @param id   the bill ID
     * @param user the user performing the action (logged for audit purposes)
     * @return the updated bill
     * @throws com.loc.electricity.application.exception.BusinessException if the period is still OPEN
     */
    @Transactional
    public Bill markSent(Long id, User user) {
        Bill bill = findById(id);

        if (bill.getPeriod().getStatus() == PeriodStatus.OPEN) {
            throw new BusinessException("PERIOD_NOT_APPROVED",
                    "Cannot mark bill as sent — period is not approved", HttpStatus.UNPROCESSABLE_ENTITY);
        }

        bill.setSentViaZalo(true);
        bill.setSentAt(LocalDateTime.now());

        if (bill.getStatus() == BillStatus.PENDING) {
            bill.setStatus(BillStatus.SENT);
        }

        log.info("Bill {} marked as sent via Zalo (status={})", id, bill.getStatus());
        return billRepository.save(bill);
    }
}
