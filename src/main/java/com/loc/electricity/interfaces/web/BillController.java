package com.loc.electricity.interfaces.web;

import com.loc.electricity.application.dto.request.CreatePaymentRequest;
import com.loc.electricity.application.dto.response.ApiResponse;
import com.loc.electricity.application.dto.response.BillResponse;
import com.loc.electricity.application.dto.response.PaymentResponse;
import com.loc.electricity.application.service.BillService;
import com.loc.electricity.application.service.PaymentService;
import com.loc.electricity.domain.user.User;
import com.loc.electricity.infrastructure.zalo.ZaloDeeplinkBuilder;
import com.loc.electricity.interfaces.security.CurrentUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/bills")
@RequiredArgsConstructor
public class BillController {

    private final BillService billService;
    private final PaymentService paymentService;
    private final ZaloDeeplinkBuilder zaloDeeplinkBuilder;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<List<BillResponse>>> listByPeriod(
            @RequestParam Long periodId) {
        List<BillResponse> response = billService.findByPeriodId(periodId)
                .stream().map(BillResponse::from).toList();
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<BillResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(BillResponse.from(billService.findById(id))));
    }

    @PostMapping("/{id}/mark-sent")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<BillResponse>> markSent(
            @PathVariable Long id,
            @CurrentUser User currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(
                BillResponse.from(billService.markSent(id, currentUser))));
    }

    @GetMapping("/{id}/zalo-link")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<Map<String, String>>> zaloLink(@PathVariable Long id) {
        String url = zaloDeeplinkBuilder.build(billService.findById(id));
        return ResponseEntity.ok(ApiResponse.ok(Map.of("url", url != null ? url : "")));
    }

    @PostMapping("/{id}/payments")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<PaymentResponse>> addPayment(
            @PathVariable Long id,
            @Valid @RequestBody CreatePaymentRequest request,
            @CurrentUser User currentUser) {
        PaymentResponse response = PaymentResponse.from(
                paymentService.createManualPayment(id, request, currentUser));
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(response));
    }
}
