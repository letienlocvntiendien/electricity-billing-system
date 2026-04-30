package com.loc.electricity.application.dto.response;

import java.math.BigDecimal;

public record PeriodReviewResponse(
        BigDecimal evnTotalAmount,
        BigDecimal extraFee,
        int totalConsumption,
        BigDecimal previewUnitPrice,
        BigDecimal serviceUnitPrice,
        BigDecimal totalBillsAmount,
        BigDecimal roundingDifference,
        int readingCount
) {}
