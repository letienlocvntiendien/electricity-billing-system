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

/**
 * REST controller for meter reading operations.
 */
@RestController
@RequiredArgsConstructor
public class MeterReadingController {

    private final MeterReadingService meterReadingService;

    /**
     * {@code GET /api/periods/{periodId}/readings} — Returns all meter readings for a billing period.
     * All authenticated roles may access this.
     *
     * @param periodId the billing period ID
     * @return list of meter readings
     */
    @GetMapping("/api/periods/{periodId}/readings")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<MeterReadingResponse>>> listByPeriod(
            @PathVariable Long periodId) {
        List<MeterReadingResponse> list = meterReadingService.findByPeriodId(periodId)
                .stream().map(MeterReadingResponse::from).toList();
        return ResponseEntity.ok(ApiResponse.ok(list));
    }

    /**
     * {@code PATCH /api/readings/{id}} — Submits a meter reading index for a customer.
     * The period must be in OPEN status. Anomaly detection runs automatically.
     * Roles: METER_READER, ADMIN, ACCOUNTANT.
     *
     * @param id          the meter reading ID
     * @param request     the new current index and optional photo URL
     * @param currentUser the authenticated user submitting the reading
     * @return the updated reading with any anomaly warning
     */
    @PatchMapping("/api/readings/{id}")
    @PreAuthorize("hasAnyRole('METER_READER','ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<MeterReadingResponse>> submitReading(
            @PathVariable Long id,
            @Valid @RequestBody UpdateMeterReadingRequest request,
            @CurrentUser User currentUser) {
        MeterReadingResponse response = meterReadingService.submitReading(id, request, currentUser);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }
}
