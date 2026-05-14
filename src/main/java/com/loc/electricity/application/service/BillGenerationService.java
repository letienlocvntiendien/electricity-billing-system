package com.loc.electricity.application.service;

import com.loc.electricity.domain.bill.Bill;
import com.loc.electricity.domain.bill.BillStatus;
import com.loc.electricity.domain.reading.MeterReading;
import com.loc.electricity.domain.shared.PeriodApprovedEvent;
import com.loc.electricity.infrastructure.pdf.PdfBillData;
import com.loc.electricity.infrastructure.pdf.PdfGenerationService;
import com.loc.electricity.infrastructure.persistence.BillRepository;
import com.loc.electricity.infrastructure.persistence.MeterReadingRepository;
import com.loc.electricity.infrastructure.persistence.SystemSettingRepository;
import com.loc.electricity.infrastructure.qr.VietQrService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class BillGenerationService {

    private static final int DEFAULT_OVERDUE_DAYS = 30;

    private final BillRepository billRepository;
    private final MeterReadingRepository meterReadingRepository;
    private final SystemSettingRepository systemSettingRepository;
    private final VietQrService vietQrService;
    private final PdfGenerationService pdfGenerationService;

    @Async("pdfTaskExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onPeriodApproved(PeriodApprovedEvent event) {
        doGenerate(event.getPeriodId());
    }

    @Async("pdfTaskExecutor")
    public void regenerateForPeriod(Long periodId) {
        doGenerate(periodId);
    }

    private void doGenerate(Long periodId) {
        log.info("Starting bill PDF generation for period {}", periodId);

        String companyName       = settingOrDefault("company_name",        "Ban Quản Lý Khu Phố");
        String companyAddress    = settingOrDefault("company_address",     "");
        String bankAccountNumber = settingOrDefault("bank_account_number", "");
        String bankAccountHolder = settingOrDefault("bank_account_holder", "");
        int overdueDays          = settingIntOrDefault("overdue_days",     DEFAULT_OVERDUE_DAYS);

        List<Bill> bills = billRepository.findAllByPeriodId(periodId);
        int success = 0;
        int failed  = 0;

        for (Bill bill : bills) {
            try {
                String qrUrl = vietQrService.buildQrUrl(bill.getPaymentCode(), bill.getTotalAmount());

                MeterReading reading = meterReadingRepository
                        .findByPeriodIdAndCustomerId(periodId, bill.getCustomer().getId())
                        .orElse(null);

                LocalDate dueDate = bill.getPeriod().getApprovedAt() != null
                        ? bill.getPeriod().getApprovedAt().toLocalDate().plusDays(overdueDays)
                        : null;

                PdfBillData data = new PdfBillData(
                        companyName,
                        companyAddress,
                        reading != null ? reading.getPreviousIndex() : 0,
                        reading != null ? reading.getCurrentIndex()  : 0,
                        dueDate,
                        bankAccountNumber,
                        bankAccountHolder
                );

                String pdfRelativePath = pdfGenerationService.generateAndStore(bill, qrUrl, data);

                bill.setQrCodeUrl(qrUrl);
                bill.setPdfUrl(pdfRelativePath);
                bill.setSentAt(java.time.LocalDateTime.now());
                if (bill.getStatus() == BillStatus.PENDING) {
                    bill.setStatus(BillStatus.SENT);
                }
                billRepository.save(bill);
                success++;
            } catch (Exception e) {
                log.error("PDF generation failed for bill {} (customer {}): {}",
                        bill.getId(), bill.getCustomer().getCode(), e.getMessage(), e);
                failed++;
            }
        }

        log.info("Bill generation for period {} complete — success={}, failed={}", periodId, success, failed);
    }

    private String settingOrDefault(String key, String defaultValue) {
        return systemSettingRepository.findById(key)
                .map(s -> s.getSettingValue().isBlank() ? defaultValue : s.getSettingValue())
                .orElse(defaultValue);
    }

    private int settingIntOrDefault(String key, int defaultValue) {
        try {
            return Integer.parseInt(settingOrDefault(key, String.valueOf(defaultValue)));
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }
}
