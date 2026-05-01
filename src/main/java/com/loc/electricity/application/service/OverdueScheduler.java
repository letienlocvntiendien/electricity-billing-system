package com.loc.electricity.application.service;

import com.loc.electricity.domain.bill.BillStatus;
import com.loc.electricity.infrastructure.persistence.BillRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class OverdueScheduler {

    private final BillRepository billRepository;
    private final SystemSettingService systemSettingService;

    @Scheduled(cron = "0 0 2 * * *")
    @Transactional
    public void markOverdueBills() {
        int overdueDays = overdueDays();
        LocalDateTime cutoff = LocalDateTime.now().minusDays(overdueDays);

        int updated = billRepository.markOverdue(
                BillStatus.OVERDUE,
                List.of(BillStatus.SENT, BillStatus.PARTIAL),
                cutoff);

        if (updated > 0) {
            log.info("Marked {} bills as OVERDUE (approvedAt before {})", updated, cutoff.toLocalDate());
        }
    }

    private int overdueDays() {
        try {
            return systemSettingService.getIntValue("overdue_days");
        } catch (Exception e) {
            return 30;
        }
    }
}
