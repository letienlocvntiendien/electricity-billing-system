package com.loc.electricity.application.dto.request;

import jakarta.validation.constraints.Size;

public record UpdateCustomerRequest(
        @Size(max = 200) String fullName,
        @Size(max = 20) String phone,
        @Size(max = 20) String zaloPhone,
        @Size(max = 50) String meterSerial,
        String notes,
        Boolean active
) {}
