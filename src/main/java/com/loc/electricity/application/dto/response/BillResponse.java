package com.loc.electricity.application.dto.response;

import com.loc.electricity.domain.bill.Bill;
import com.loc.electricity.domain.bill.BillStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record BillResponse(
        Long id,
        Long periodId,
        String periodCode,
        Long customerId,
        String customerCode,
        String customerName,
        int consumption,
        BigDecimal unitPrice,
        BigDecimal serviceFee,
        BigDecimal electricityAmount,
        BigDecimal serviceAmount,
        BigDecimal totalAmount,
        BigDecimal paidAmount,
        BillStatus status,
        String paymentCode,
        String qrCodeUrl,
        String pdfUrl,
        boolean sentViaZalo,
        LocalDateTime sentAt,
        LocalDateTime createdAt
) {
    public static BillResponse from(Bill b) {
        return new BillResponse(
                b.getId(), b.getPeriod().getId(), b.getPeriod().getCode(),
                b.getCustomer().getId(), b.getCustomer().getCode(), b.getCustomer().getFullName(),
                b.getConsumption(), b.getUnitPrice(), b.getServiceFee(),
                b.getElectricityAmount(), b.getServiceAmount(), b.getTotalAmount(),
                b.getPaidAmount(), b.getStatus(), b.getPaymentCode(),
                b.getQrCodeUrl(), b.getPdfUrl(), b.isSentViaZalo(), b.getSentAt(),
                b.getCreatedAt());
    }
}
