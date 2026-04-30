package com.loc.electricity.application.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record UpdatePeriodRequest(
        @Size(max = 100) String name,
        @DecimalMin("0") BigDecimal extraFee,
        @DecimalMin("0") BigDecimal serviceUnitPrice
) {}
