package com.loc.electricity.application.dto.response;

import com.loc.electricity.domain.reading.MeterReading;

import java.time.LocalDateTime;

public record MeterReadingResponse(
        Long id,
        Long periodId,
        Long customerId,
        String customerCode,
        String customerFullName,
        int previousIndex,
        int currentIndex,
        int consumption,
        String readingPhotoUrl,
        LocalDateTime readAt,
        boolean submitted,
        String warning
) {
    public static MeterReadingResponse from(MeterReading r) {
        return from(r, r.getWarning());
    }

    public static MeterReadingResponse from(MeterReading r, String warning) {
        return new MeterReadingResponse(
                r.getId(),
                r.getPeriod().getId(),
                r.getCustomer().getId(),
                r.getCustomer().getCode(),
                r.getCustomer().getFullName(),
                r.getPreviousIndex(),
                r.getCurrentIndex(),
                r.computedConsumption(),
                r.getReadingPhotoUrl(),
                r.getReadAt(),
                r.getReadAt() != null,
                warning);
    }
}
