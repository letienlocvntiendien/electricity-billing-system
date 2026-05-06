package com.loc.electricity.application.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record PeriodReviewResponse(
        // EVN totals
        int evnTotalKwh,
        BigDecimal evnTotalAmount,
        BigDecimal extraFee,

        // Consumption & loss
        int totalActualConsumption,
        int lossKwh,
        double lossPercentage,
        boolean lossWarning,

        // Pricing
        BigDecimal previewUnitPrice,
        BigDecimal serviceFee,
        int activeBillCount,

        // Totals (null before calculate)
        BigDecimal totalBillsAmount,
        BigDecimal roundingDifference,
        int submittedReadingCount,

        // 4-eyes verification state
        String accountantVerifiedBy,
        LocalDateTime accountantVerifiedAt
) {}
