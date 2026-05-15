package com.loc.electricity.application.service;

import com.loc.electricity.domain.bill.BillStatus;
import com.loc.electricity.infrastructure.persistence.BillRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Scheduled job that marks unpaid bills as OVERDUE every night at 02:00.
 * Disabled in {@code dev} and {@code local} profiles to avoid interference during development.
 */
@Component
@Profile("!dev & !local")
@RequiredArgsConstructor
@Slf4j
public class OverdueScheduler {

    private final BillRepository billRepository;
    private final SystemSettingService systemSettingService;

    /**
     * Marks SENT and PARTIAL bills as OVERDUE if their period was approved more than
     * {@code overdue_days} system-setting days ago.
     * Runs at 02:00 every day via cron.
     */
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
