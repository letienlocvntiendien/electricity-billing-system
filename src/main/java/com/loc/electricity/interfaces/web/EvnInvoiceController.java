package com.loc.electricity.interfaces.web;

import com.loc.electricity.application.dto.request.CreateEvnInvoiceRequest;
import com.loc.electricity.application.dto.request.UpdateEvnInvoiceRequest;
import com.loc.electricity.application.dto.response.ApiResponse;
import com.loc.electricity.application.dto.response.EvnInvoiceResponse;
import com.loc.electricity.application.service.EvnInvoiceService;
import com.loc.electricity.domain.user.User;
import com.loc.electricity.interfaces.security.CurrentUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/periods/{periodId}/evn-invoices")
@RequiredArgsConstructor
public class EvnInvoiceController {

    private final EvnInvoiceService evnInvoiceService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<List<EvnInvoiceResponse>>> list(@PathVariable Long periodId) {
        List<EvnInvoiceResponse> response = evnInvoiceService.findByPeriodId(periodId)
                .stream().map(EvnInvoiceResponse::from).toList();
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<EvnInvoiceResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(EvnInvoiceResponse.from(evnInvoiceService.findById(id))));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<EvnInvoiceResponse>> create(
            @PathVariable Long periodId,
            @Valid @RequestBody CreateEvnInvoiceRequest request,
            @CurrentUser User currentUser) {
        EvnInvoiceResponse response = EvnInvoiceResponse.from(
                evnInvoiceService.create(periodId, request, currentUser));
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(response));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<EvnInvoiceResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateEvnInvoiceRequest request,
            @CurrentUser User currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(
                EvnInvoiceResponse.from(evnInvoiceService.update(id, request, currentUser))));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable Long id,
            @CurrentUser User currentUser) {
        evnInvoiceService.delete(id, currentUser);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
