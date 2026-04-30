package com.loc.electricity.application.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateCustomerRequest(
        @NotBlank @Size(max = 20) String code,
        @NotBlank @Size(max = 200) String fullName,
        @Size(max = 20) String phone,
        @Size(max = 20) String zaloPhone,
        @Size(max = 50) String meterSerial,
        String notes
) {}
