package com.loc.electricity.infrastructure.webhook;

import com.loc.electricity.domain.bill.Bill;
import com.loc.electricity.domain.bill.BillStatus;
import com.loc.electricity.domain.payment.Payment;
import com.loc.electricity.domain.payment.PaymentMethod;
import com.loc.electricity.domain.shared.AuditAction;
import com.loc.electricity.domain.shared.AuditEvent;
import com.loc.electricity.infrastructure.persistence.BillRepository;
import com.loc.electricity.infrastructure.persistence.PaymentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Processes incoming SePay bank transfer notifications.
 * <p>
 * Matches transfers to bills via the payment code embedded in the transfer description
 * (pattern: {@code TIENDIEN <code> <suffix>}), records a {@link com.loc.electricity.domain.payment.Payment},
 * and advances the matched bill to {@code PAID} or {@code PARTIAL} status.
 * Unmatched transfers are saved with {@code bill = null} for manual reconciliation.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SepayWebhookService {

    private static final Pattern PAYMENT_CODE_PATTERN =
            Pattern.compile("TIENDIEN\\s+(\\S+)\\s+(\\S+)", Pattern.CASE_INSENSITIVE);
    private static final DateTimeFormatter SEPAY_DATE_FMT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final PaymentRepository paymentRepository;
    private final BillRepository billRepository;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * Processes a single SePay bank transfer notification.
     * <p>
     * Skips non-inbound transfers and duplicate transaction IDs.
     * Always saves a {@link com.loc.electricity.domain.payment.Payment} record regardless of match result;
     * if a bill is matched, updates its {@code paidAmount} and advances the bill status.
     *
     * @param payload the SePay notification payload
     */
    @Transactional
    public void handleWebhook(SepayWebhookPayload payload) {
        if (!"in".equalsIgnoreCase(payload.getTransferType())) {
            log.debug("Skipping non-inbound transfer type: {}", payload.getTransferType());
            return;
        }

        String txnId = String.valueOf(payload.getId());
        if (paymentRepository.existsByBankTransactionId(txnId)) {
            log.info("Duplicate SePay transaction {} — skipping", txnId);
            return;
        }

        Bill matchedBill = parsePaymentCode(payload.getContent())
                .flatMap(billRepository::findByPaymentCode)
                .orElse(null);

        LocalDateTime paidAt = parseTransactionDate(payload.getTransactionDate());

        Payment payment = Payment.builder()
                .bill(matchedBill)
                .amount(payload.getTransferAmount())
                .method(PaymentMethod.BANK_TRANSFER)
                .paidAt(paidAt)
                .bankTransactionId(txnId)
                .bankReferenceCode(payload.getReferenceCode())
                .rawContent(payload.getContent())
                .build();
        paymentRepository.save(payment);

        if (matchedBill != null) {
            updateBillStatus(matchedBill, payload.getTransferAmount());
            eventPublisher.publishEvent(new AuditEvent(this, AuditAction.CREATE_PAYMENT,
                    "Payment", payment.getId(), null, payment, null));
            log.info("SePay txn {} matched to bill {} ({})", txnId, matchedBill.getId(), matchedBill.getPaymentCode());
        } else {
            log.warn("SePay txn {} content '{}' did not match any bill — saved as unmatched",
                    txnId, payload.getContent());
        }
    }

    private Optional<String> parsePaymentCode(String content) {
        if (content == null) return Optional.empty();
        Matcher m = PAYMENT_CODE_PATTERN.matcher(content);
        if (m.find()) {
            return Optional.of("TIENDIEN " + m.group(1).toUpperCase() + " " + m.group(2).toUpperCase());
        }
        return Optional.empty();
    }

    private void updateBillStatus(Bill bill, BigDecimal incoming) {
        BigDecimal newPaid = bill.getPaidAmount().add(incoming);
        bill.setPaidAmount(newPaid);
        bill.setStatus(newPaid.compareTo(bill.getTotalAmount()) >= 0 ? BillStatus.PAID : BillStatus.PARTIAL);
        billRepository.save(bill);
    }

    private LocalDateTime parseTransactionDate(String raw) {
        if (raw == null) return LocalDateTime.now();
        try {
            return LocalDateTime.parse(raw, SEPAY_DATE_FMT);
        } catch (Exception e) {
            log.warn("Could not parse transactionDate '{}', using now()", raw);
            return LocalDateTime.now();
        }
    }
}
