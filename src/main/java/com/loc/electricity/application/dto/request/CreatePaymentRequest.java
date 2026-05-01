package com.loc.electricity.application.dto.request;

import com.loc.electricity.domain.payment.PaymentMethod;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record CreatePaymentRequest(
        @NotNull @DecimalMin("0.01") BigDecimal amount,
        @NotNull PaymentMethod method,
        @NotNull LocalDateTime paidAt,
        String notes
) {}
