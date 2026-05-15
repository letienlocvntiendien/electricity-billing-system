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

/**
 * REST controller for managing unmatched bank transfer payments. Roles: ADMIN, ACCOUNTANT.
 */
@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;

    /**
     * {@code GET /api/payments/unmatched} — Returns paginated bank transfer payments
     * that have not yet been matched to a bill. Roles: ADMIN, ACCOUNTANT.
     *
     * @param pageable pagination and sorting (default: size=20, sort=createdAt)
     * @return page of unmatched payments
     */
    @GetMapping("/unmatched")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<Page<PaymentResponse>>> listUnmatched(
            @PageableDefault(size = 20, sort = "createdAt") Pageable pageable) {
        Page<PaymentResponse> page = paymentService.findUnmatched(pageable)
                .map(PaymentResponse::from);
        return ResponseEntity.ok(ApiResponse.ok(page));
    }

    /**
     * {@code POST /api/payments/{id}/assign} — Links an unmatched payment to a bill.
     * Recalculates the bill's paid amount and status. Roles: ADMIN, ACCOUNTANT.
     *
     * @param id          the unmatched payment ID
     * @param request     contains the target bill ID
     * @param currentUser the authenticated user
     * @return the updated payment
     */
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
