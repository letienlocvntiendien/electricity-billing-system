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

/**
 * REST controller for EVN master invoice management scoped to a billing period.
 * Roles: ADMIN, ACCOUNTANT. All mutations are blocked when the period is APPROVED or CLOSED.
 */
@RestController
@RequestMapping("/api/periods/{periodId}/evn-invoices")
@RequiredArgsConstructor
public class EvnInvoiceController {

    private final EvnInvoiceService evnInvoiceService;

    /**
     * {@code GET /api/periods/{periodId}/evn-invoices} — Lists all EVN invoices for the period.
     *
     * @param periodId the billing period ID
     * @return list of EVN invoices
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<List<EvnInvoiceResponse>>> list(@PathVariable Long periodId) {
        List<EvnInvoiceResponse> response = evnInvoiceService.findByPeriodId(periodId)
                .stream().map(EvnInvoiceResponse::from).toList();
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    /**
     * {@code GET /api/periods/{periodId}/evn-invoices/{id}} — Returns a single EVN invoice.
     *
     * @param id the invoice ID
     * @return the EVN invoice
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<EvnInvoiceResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(EvnInvoiceResponse.from(evnInvoiceService.findById(id))));
    }

    /**
     * {@code POST /api/periods/{periodId}/evn-invoices} — Creates an EVN invoice for the period.
     *
     * @param periodId    the billing period ID
     * @param request     invoice details
     * @param currentUser the authenticated user
     * @return the created invoice with HTTP 201
     */
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

    /**
     * {@code PUT /api/periods/{periodId}/evn-invoices/{id}} — Replaces all fields of an EVN invoice.
     *
     * @param id          the invoice ID
     * @param request     new invoice fields
     * @param currentUser the authenticated user
     * @return the updated invoice
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<EvnInvoiceResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateEvnInvoiceRequest request,
            @CurrentUser User currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(
                EvnInvoiceResponse.from(evnInvoiceService.update(id, request, currentUser))));
    }

    /**
     * {@code DELETE /api/periods/{periodId}/evn-invoices/{id}} — Deletes an EVN invoice.
     *
     * @param id          the invoice ID
     * @param currentUser the authenticated user
     * @return empty 200 response
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable Long id,
            @CurrentUser User currentUser) {
        evnInvoiceService.delete(id, currentUser);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
