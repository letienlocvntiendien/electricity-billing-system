package com.loc.electricity.interfaces.web;

import com.loc.electricity.application.dto.request.CreatePaymentRequest;
import com.loc.electricity.application.dto.request.SendSmsRequest;
import com.loc.electricity.application.dto.response.ApiResponse;
import com.loc.electricity.application.dto.response.BillResponse;
import com.loc.electricity.application.dto.response.PaymentResponse;
import com.loc.electricity.application.dto.response.SmsResultResponse;
import com.loc.electricity.application.service.BillService;
import com.loc.electricity.application.service.PaymentService;
import com.loc.electricity.application.service.SmsNotificationService;
import com.loc.electricity.domain.bill.Bill;
import com.loc.electricity.domain.user.User;
import com.loc.electricity.infrastructure.storage.FileStorageService;
import com.loc.electricity.infrastructure.zalo.ZaloDeeplinkBuilder;
import com.loc.electricity.interfaces.security.CurrentUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST controller for bill operations including payment recording, PDF retrieval, and SMS sending.
 * Roles: ADMIN, ACCOUNTANT.
 */
@RestController
@RequestMapping("/api/bills")
@RequiredArgsConstructor
public class BillController {

    private final BillService billService;
    private final PaymentService paymentService;
    private final ZaloDeeplinkBuilder zaloDeeplinkBuilder;
    private final FileStorageService fileStorageService;
    private final SmsNotificationService smsNotificationService;

    /**
     * {@code GET /api/bills?periodId={id}} — Returns all bills for a billing period.
     *
     * @param periodId the billing period ID
     * @return list of bills
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<List<BillResponse>>> listByPeriod(
            @RequestParam Long periodId) {
        List<BillResponse> response = billService.findByPeriodId(periodId)
                .stream().map(BillResponse::from).toList();
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    /**
     * {@code GET /api/bills/{id}} — Returns a single bill.
     *
     * @param id the bill ID
     * @return the bill
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<BillResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(BillResponse.from(billService.findById(id))));
    }

    /**
     * {@code POST /api/bills/{id}/mark-sent} — Marks a bill as sent and advances status to SENT.
     *
     * @param id          the bill ID
     * @param currentUser the authenticated user
     * @return the updated bill
     */
    @PostMapping("/{id}/mark-sent")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<BillResponse>> markSent(
            @PathVariable Long id,
            @CurrentUser User currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(
                BillResponse.from(billService.markSent(id, currentUser))));
    }

    /**
     * {@code GET /api/bills/{id}/zalo-link} — Builds a Zalo deep-link pre-filled with bill payment details.
     * Returns an empty URL if the customer has no phone number.
     *
     * @param id the bill ID
     * @return map containing {@code url} key with the Zalo deep-link
     */
    @GetMapping("/{id}/zalo-link")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<Map<String, String>>> zaloLink(@PathVariable Long id) {
        String url = zaloDeeplinkBuilder.build(billService.findById(id));
        return ResponseEntity.ok(ApiResponse.ok(Map.of("url", url != null ? url : "")));
    }

    /**
     * {@code GET /api/bills/{id}/pdf} — Streams the generated PDF for a bill as an inline attachment.
     * Returns 404 if the PDF has not yet been generated.
     *
     * @param id the bill ID
     * @return the PDF bytes with Content-Type application/pdf
     */
    @GetMapping("/{id}/pdf")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<byte[]> getPdf(@PathVariable Long id) {
        Bill bill = billService.findById(id);
        if (bill.getPdfUrl() == null) {
            return ResponseEntity.notFound().build();
        }
        byte[] bytes = fileStorageService.load(bill.getPdfUrl());
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition.inline()
                .filename("bill-" + bill.getId() + ".pdf").build());
        return ResponseEntity.ok().headers(headers).body(bytes);
    }

    /**
     * {@code POST /api/bills/{id}/payments} — Records a manual payment for a bill.
     *
     * @param id          the bill ID
     * @param request     payment details (amount, method, paidAt)
     * @param currentUser the authenticated user recording the payment
     * @return the created payment with HTTP 201
     */
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

    /**
     * {@code GET /api/bills/{id}/payments} — Returns all payments for a bill, newest first.
     *
     * @param id the bill ID
     * @return list of payments
     */
    @GetMapping("/{id}/payments")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<List<PaymentResponse>>> listPayments(@PathVariable Long id) {
        List<PaymentResponse> payments = paymentService.findByBillId(id)
                .stream().map(PaymentResponse::from).toList();
        return ResponseEntity.ok(ApiResponse.ok(payments));
    }

    /**
     * {@code POST /api/bills/send-sms} — Sends SMS bill notifications for a batch of bill IDs via AWS SNS.
     *
     * @param request     contains the list of bill IDs to notify
     * @param currentUser the authenticated user triggering the batch send
     * @return per-bill send results with success/failure details
     */
    @PostMapping("/send-sms")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<List<SmsResultResponse>>> sendSms(
            @Valid @RequestBody SendSmsRequest request,
            @CurrentUser User currentUser) {
        List<SmsResultResponse> results = smsNotificationService.sendBillSmsBatch(request.billIds(), currentUser);
        return ResponseEntity.ok(ApiResponse.ok(results));
    }
}
