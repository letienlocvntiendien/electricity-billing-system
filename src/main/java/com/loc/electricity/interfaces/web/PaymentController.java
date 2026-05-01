package com.loc.electricity.interfaces.web;

import com.loc.electricity.application.dto.request.AssignPaymentRequest;
import com.loc.electricity.application.dto.response.ApiResponse;
import com.loc.electricity.application.dto.response.PaymentResponse;
import com.loc.electricity.application.service.PaymentService;
import com.loc.electricity.domain.user.User;
import com.loc.electricity.interfaces.security.CurrentUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;

    @GetMapping("/unmatched")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<Page<PaymentResponse>>> listUnmatched(
            @PageableDefault(size = 20, sort = "createdAt") Pageable pageable) {
        Page<PaymentResponse> page = paymentService.findUnmatched(pageable)
                .map(PaymentResponse::from);
        return ResponseEntity.ok(ApiResponse.ok(page));
    }

    @PostMapping("/{id}/assign")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<PaymentResponse>> assign(
            @PathVariable Long id,
            @Valid @RequestBody AssignPaymentRequest request,
            @CurrentUser User currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(
                PaymentResponse.from(paymentService.assignPayment(id, request, currentUser))));
    }
}
