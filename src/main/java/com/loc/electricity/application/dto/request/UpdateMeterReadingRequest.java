package com.loc.electricity.application.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record UpdateMeterReadingRequest(
        @NotNull @Min(0) Integer currentIndex,
        String readingPhotoUrl
) {}
