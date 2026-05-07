package com.loc.electricity.interfaces.web;

import com.loc.electricity.application.dto.request.UpdateMeterReadingRequest;
import com.loc.electricity.application.dto.response.ApiResponse;
import com.loc.electricity.application.dto.response.MeterReadingResponse;
import com.loc.electricity.application.service.MeterReadingService;
import com.loc.electricity.domain.user.User;
import com.loc.electricity.interfaces.security.CurrentUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class MeterReadingController {

    private final MeterReadingService meterReadingService;

    @GetMapping("/api/periods/{periodId}/readings")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<MeterReadingResponse>>> listByPeriod(
            @PathVariable Long periodId) {
        List<MeterReadingResponse> list = meterReadingService.findByPeriodId(periodId)
                .stream().map(MeterReadingResponse::from).toList();
        return ResponseEntity.ok(ApiResponse.ok(list));
    }

    @PatchMapping("/api/readings/{id}")
    @PreAuthorize("hasAnyRole('METER_READER','ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<MeterReadingResponse>> submitReading(
            @PathVariable Long id,
            @Valid @RequestBody UpdateMeterReadingRequest request,
            @CurrentUser User currentUser) {
        var response = meterReadingService.submitReading(id, request, currentUser);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }
}
