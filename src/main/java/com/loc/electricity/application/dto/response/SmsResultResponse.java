package com.loc.electricity.application.dto.response;

public record SmsResultResponse(
        Long billId,
        String customerCode,
        String customerName,
        String phone,
        boolean success,
        String errorMessage
) {}
