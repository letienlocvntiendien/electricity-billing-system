package com.loc.electricity.application.dto.request;

import jakarta.validation.constraints.NotNull;

public record AssignPaymentRequest(@NotNull Long billId) {}
