package com.loc.electricity.application.dto.response;

import com.loc.electricity.domain.bill.BillStatus;

import java.math.BigDecimal;
import java.util.Map;

public record PeriodSummaryResponse(
        Long periodId,
        String periodCode,
        String periodName,
        int totalBills,
        BigDecimal totalBilledAmount,
        BigDecimal totalPaidAmount,
        BigDecimal outstandingAmount,
        Map<BillStatus, Long> countByStatus,
        BigDecimal roundingDifference
) {}
