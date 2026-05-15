package com.loc.electricity.interfaces.web;

import com.loc.electricity.application.dto.request.CreatePeriodRequest;
import com.loc.electricity.application.dto.request.UpdatePeriodRequest;
import com.loc.electricity.application.dto.response.ApiResponse;
import com.loc.electricity.application.dto.response.PeriodResponse;
import com.loc.electricity.application.dto.response.PeriodReviewResponse;
import com.loc.electricity.application.exception.BusinessException;
import com.loc.electricity.application.service.BillGenerationService;
import com.loc.electricity.application.service.PeriodService;
import com.loc.electricity.domain.period.BillingPeriod;
import com.loc.electricity.domain.period.PeriodStatus;
import com.loc.electricity.domain.user.User;
import com.loc.electricity.infrastructure.pdf.PrintPackService;
import com.loc.electricity.interfaces.security.CurrentUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller for billing period management and state machine transitions.
 * Most write operations require ADMIN; calculation and verification require ACCOUNTANT or ADMIN.
 */
@RestController
@RequestMapping("/api/periods")
@RequiredArgsConstructor
public class PeriodController {

    private final PeriodService periodService;
    private final PrintPackService printPackService;
    private final BillGenerationService billGenerationService;

    /**
     * {@code GET /api/periods} — Returns all billing periods, paginated.
     *
     * @param pageable pagination and sorting (default: size=20, sort=startDate)
     * @return page of billing periods
     */
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Page<PeriodResponse>>> list(
            @PageableDefault(size = 20, sort = "startDate") Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.ok(
                periodService.findAll(pageable).map(PeriodResponse::from)));
    }

    /**
     * {@code GET /api/periods/{id}} — Returns a single billing period.
     *
     * @param id the period ID
     * @return the billing period
     */
    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<PeriodResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(PeriodResponse.from(periodService.findById(id))));
    }

    /**
     * {@code GET /api/periods/current} — Returns the most recent period in OPEN or READING_DONE status.
     *
     * @return the current active billing period
     */
    @GetMapping("/current")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<PeriodResponse>> getCurrent() {
        return ResponseEntity.ok(ApiResponse.ok(PeriodResponse.from(periodService.findCurrent())));
    }

    /**
     * {@code POST /api/periods} — Creates a new billing period in OPEN status. Role: ADMIN.
     *
     * @param request     period details (name, startDate, endDate, serviceFee, extraFee)
     * @param currentUser the authenticated admin
     * @return the created period with HTTP 201
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<PeriodResponse>> create(
            @Valid @RequestBody CreatePeriodRequest request,
            @CurrentUser User currentUser) {
        PeriodResponse response = PeriodResponse.from(periodService.createPeriod(request, currentUser));
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(response));
    }

    /**
     * {@code PATCH /api/periods/{id}} — Updates period name, extraFee, or serviceFee.
     * Blocked when period is APPROVED or CLOSED. Roles: ADMIN, ACCOUNTANT.
     *
     * @param id          the period ID
     * @param request     fields to update
     * @param currentUser the authenticated user
     * @return the updated period
     */
    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<PeriodResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody UpdatePeriodRequest request,
            @CurrentUser User currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(
                PeriodResponse.from(periodService.update(id, request, currentUser))));
    }

    /**
     * {@code GET /api/periods/{id}/review} — Returns a pre-calculation summary including line-loss
     * analysis, preview unit price, and accountant verification status. Read-only. Roles: ADMIN, ACCOUNTANT.
     *
     * @param id the period ID
     * @return the review summary
     */
    @GetMapping("/{id}/review")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<PeriodReviewResponse>> review(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(periodService.review(id)));
    }

    /**
     * {@code POST /api/periods/{id}/calculate} — Runs the billing formula and transitions
     * period to CALCULATED. Requires READING_DONE status. Roles: ADMIN, ACCOUNTANT.
     *
     * @param id          the period ID
     * @param currentUser the authenticated user
     * @return the updated period
     */
    @PostMapping("/{id}/calculate")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<PeriodResponse>> calculate(
            @PathVariable Long id,
            @CurrentUser User currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(
                PeriodResponse.from(periodService.calculate(id, currentUser))));
    }

    /**
     * {@code POST /api/periods/{id}/approve} — Approves the period and triggers PDF generation.
     * Requires prior accountant verification. Role: ADMIN.
     *
     * @param id          the period ID
     * @param currentUser the authenticated admin
     * @return the updated period
     */
    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<PeriodResponse>> approve(
            @PathVariable Long id,
            @CurrentUser User currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(
                PeriodResponse.from(periodService.approve(id, currentUser))));
    }

    /**
     * {@code POST /api/periods/{id}/revert} — Reverts the period to OPEN from CALCULATED or APPROVED.
     * Deletes all bills and clears verification/approval metadata. Role: ADMIN.
     *
     * @param id          the period ID
     * @param currentUser the authenticated admin
     * @return the reverted period
     */
    @PostMapping("/{id}/revert")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<PeriodResponse>> revert(
            @PathVariable Long id,
            @CurrentUser User currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(
                PeriodResponse.from(periodService.revert(id, currentUser))));
    }

    /**
     * {@code POST /api/periods/{id}/submit-readings} — Transitions the period from OPEN to READING_DONE.
     * Role: METER_READER.
     *
     * @param id          the period ID
     * @param currentUser the authenticated meter reader
     * @return the updated period
     */
    @PostMapping("/{id}/submit-readings")
    @PreAuthorize("hasRole('METER_READER')")
    public ResponseEntity<ApiResponse<PeriodResponse>> submitReadings(
            @PathVariable Long id,
            @CurrentUser User currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(
                PeriodResponse.from(periodService.submitReadings(id, currentUser))));
    }

    /**
     * {@code POST /api/periods/{id}/verify} — Records accountant verification.
     * Period remains CALCULATED; sets verifiedAt timestamp. Roles: ACCOUNTANT, ADMIN.
     *
     * @param id          the period ID
     * @param currentUser the authenticated accountant or admin
     * @return the updated period
     */
    @PostMapping("/{id}/verify")
    @PreAuthorize("hasAnyRole('ACCOUNTANT','ADMIN')")
    public ResponseEntity<ApiResponse<PeriodResponse>> verify(
            @PathVariable Long id,
            @CurrentUser User currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(
                PeriodResponse.from(periodService.verify(id, currentUser))));
    }

    /**
     * {@code POST /api/periods/{id}/close} — Closes the period. Blocked if any bills remain unpaid.
     * Role: ADMIN.
     *
     * @param id          the period ID
     * @param currentUser the authenticated admin
     * @return the closed period
     */
    @PostMapping("/{id}/close")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<PeriodResponse>> close(
            @PathVariable Long id,
            @CurrentUser User currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(
                PeriodResponse.from(periodService.close(id, currentUser))));
    }

    /**
     * {@code POST /api/periods/{id}/generate-bills} — Manually triggers PDF and QR regeneration
     * for all bills in the period. Period must be APPROVED or CLOSED. Role: ADMIN.
     * Processing is asynchronous — this endpoint returns immediately with HTTP 202.
     *
     * @param id the period ID
     * @return accepted response with status message
     */
    @PostMapping("/{id}/generate-bills")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<String>> generateBills(@PathVariable Long id) {
        BillingPeriod period = periodService.findById(id);
        if (period.getStatus() != PeriodStatus.APPROVED && period.getStatus() != PeriodStatus.CLOSED) {
            throw new BusinessException("INVALID_STATUS",
                    "Chỉ có thể tạo PDF/QR cho kỳ đã APPROVED hoặc CLOSED",
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }
        billGenerationService.regenerateForPeriod(id);
        return ResponseEntity.accepted().body(ApiResponse.ok("Đang tạo hóa đơn PDF..."));
    }

    /**
     * {@code GET /api/periods/{id}/print-pack} — Merges all bill PDFs for the period into
     * a single downloadable PDF file. Roles: ADMIN, ACCOUNTANT.
     *
     * @param id the period ID
     * @return merged PDF as attachment with filename {@code print-pack-{code}.pdf}
     */
    @GetMapping("/{id}/print-pack")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<byte[]> printPack(@PathVariable Long id) {
        BillingPeriod period = periodService.findById(id);
        byte[] pdf = printPackService.generatePrintPack(id);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition.attachment()
                .filename("print-pack-" + period.getCode() + ".pdf")
                .build());
        return ResponseEntity.ok().headers(headers).body(pdf);
    }
}
