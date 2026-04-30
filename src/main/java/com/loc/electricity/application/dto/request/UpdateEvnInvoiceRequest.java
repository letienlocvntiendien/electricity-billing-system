package com.loc.electricity.application.dto.request;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;

public record UpdateEvnInvoiceRequest(
        @NotNull LocalDate invoiceDate,
        @NotBlank @Size(max = 50) String invoiceNumber,
        @Min(0) int kwh,
        @NotNull @DecimalMin("0") BigDecimal amount,
        String attachmentUrl
) {}
