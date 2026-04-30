package com.loc.electricity.application.dto.response;

import com.loc.electricity.domain.period.BillingPeriod;
import com.loc.electricity.domain.period.PeriodStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record PeriodResponse(
        Long id,
        String code,
        String name,
        LocalDate startDate,
        LocalDate endDate,
        BigDecimal evnTotalAmount,
        int evnTotalKwh,
        BigDecimal extraFee,
        BigDecimal unitPrice,
        BigDecimal serviceUnitPrice,
        PeriodStatus status,
        LocalDateTime approvedAt,
        LocalDateTime closedAt,
        LocalDateTime createdAt
) {
    public static PeriodResponse from(BillingPeriod p) {
        return new PeriodResponse(
                p.getId(), p.getCode(), p.getName(),
                p.getStartDate(), p.getEndDate(),
                p.getEvnTotalAmount(), p.getEvnTotalKwh(), p.getExtraFee(),
                p.getUnitPrice(), p.getServiceUnitPrice(), p.getStatus(),
                p.getApprovedAt(), p.getClosedAt(), p.getCreatedAt());
    }
}
