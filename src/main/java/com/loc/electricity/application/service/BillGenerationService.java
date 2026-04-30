package com.loc.electricity.application.service;

import com.loc.electricity.domain.bill.Bill;
import com.loc.electricity.domain.bill.BillStatus;
import com.loc.electricity.domain.shared.PeriodApprovedEvent;
import com.loc.electricity.infrastructure.pdf.PdfGenerationService;
import com.loc.electricity.infrastructure.persistence.BillRepository;
import com.loc.electricity.infrastructure.qr.VietQrService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class BillGenerationService {

    private final BillRepository billRepository;
    private final VietQrService vietQrService;
    private final PdfGenerationService pdfGenerationService;

    @Async("pdfTaskExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onPeriodApproved(PeriodApprovedEvent event) {
        Long periodId = event.getPeriodId();
        log.info("Starting bill PDF generation for period {}", periodId);

        List<Bill> bills = billRepository.findAllByPeriodId(periodId);
        int success = 0;
        int failed = 0;

        for (Bill bill : bills) {
            try {
                String qrUrl = vietQrService.buildQrUrl(bill.getPaymentCode(), bill.getTotalAmount());
                String pdfRelativePath = pdfGenerationService.generateAndStore(bill, qrUrl);

                bill.setQrCodeUrl(qrUrl);
                bill.setPdfUrl(pdfRelativePath);
                bill.setSentAt(LocalDateTime.now());
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
}
