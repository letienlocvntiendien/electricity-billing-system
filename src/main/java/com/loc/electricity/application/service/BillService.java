package com.loc.electricity.application.service;

import com.loc.electricity.application.exception.BusinessException;
import com.loc.electricity.application.exception.ResourceNotFoundException;
import com.loc.electricity.domain.bill.Bill;
import com.loc.electricity.domain.bill.BillStatus;
import com.loc.electricity.domain.user.User;
import com.loc.electricity.infrastructure.persistence.BillRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class BillService {

    private final BillRepository billRepository;

    public List<Bill> findByPeriodId(Long periodId) {
        return billRepository.findAllByPeriodId(periodId);
    }

    public Bill findById(Long id) {
        return billRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bill", id));
    }

    @Transactional
    public Bill markSent(Long id, User user) {
        Bill bill = findById(id);

        if (bill.getPeriod().getStatus().name().equals("OPEN")) {
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
