package com.loc.electricity.application.dto.response;

import com.loc.electricity.domain.bill.BillStatus;

import java.math.BigDecimal;
import java.util.List;

public record CustomerDebtSummaryResponse(
        Long customerId,
        String customerCode,
        String customerName,
        String customerPhone,
        int unpaidBillCount,
        String oldestUnpaidPeriodName,
        BigDecimal totalBilledAmount,
        BigDecimal totalPaidAmount,
        BigDecimal totalOutstanding,
        BillStatus worstStatus,
        List<BillResponse> bills
) {}
