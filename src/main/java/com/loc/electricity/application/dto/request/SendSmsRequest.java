package com.loc.electricity.application.dto.request;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record SendSmsRequest(@NotEmpty List<Long> billIds) {}
