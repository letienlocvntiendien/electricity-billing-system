package com.loc.electricity.application.dto.response;

import com.loc.electricity.domain.customer.Customer;

import java.time.LocalDateTime;

public record CustomerResponse(
        Long id,
        String code,
        String fullName,
        String phone,
        String zaloPhone,
        String meterSerial,
        String notes,
        boolean active,
        LocalDateTime createdAt
) {
    public static CustomerResponse from(Customer c) {
        return new CustomerResponse(c.getId(), c.getCode(), c.getFullName(),
                c.getPhone(), c.getZaloPhone(), c.getMeterSerial(),
                c.getNotes(), c.isActive(), c.getCreatedAt());
    }
}
