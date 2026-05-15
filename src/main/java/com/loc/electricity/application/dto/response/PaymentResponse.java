package com.loc.electricity.application.dto.response;

import com.loc.electricity.domain.bill.Bill;
import com.loc.electricity.domain.payment.Payment;
import com.loc.electricity.domain.payment.PaymentMethod;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record PaymentResponse(
        Long id,
        Long billId,
        String paymentCode,
        BigDecimal amount,
        PaymentMethod method,
        LocalDateTime paidAt,
        String bankTransactionId,
        String bankReferenceCode,
        String rawContent,
        String notes,
        LocalDateTime createdAt
) {
    public static PaymentResponse from(Payment p) {
        Bill bill = p.getBill();
        return new PaymentResponse(
                p.getId(),
                bill != null ? bill.getId() : null,
                bill != null ? bill.getPaymentCode() : null,
                p.getAmount(), p.getMethod(), p.getPaidAt(),
                p.getBankTransactionId(), p.getBankReferenceCode(),
                p.getRawContent(), p.getNotes(), p.getCreatedAt());
    }
}
