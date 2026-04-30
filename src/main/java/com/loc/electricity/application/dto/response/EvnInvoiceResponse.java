package com.loc.electricity.application.dto.response;

import com.loc.electricity.domain.period.EvnInvoice;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record EvnInvoiceResponse(
        Long id,
        Long periodId,
        LocalDate invoiceDate,
        String invoiceNumber,
        int kwh,
        BigDecimal amount,
        String attachmentUrl,
        LocalDateTime createdAt
) {
    public static EvnInvoiceResponse from(EvnInvoice e) {
        return new EvnInvoiceResponse(
                e.getId(), e.getPeriod().getId(),
                e.getInvoiceDate(), e.getInvoiceNumber(),
                e.getKwh(), e.getAmount(), e.getAttachmentUrl(),
                e.getCreatedAt());
    }
}
