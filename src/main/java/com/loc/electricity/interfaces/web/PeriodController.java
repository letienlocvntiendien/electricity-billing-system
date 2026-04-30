package com.loc.electricity.interfaces.web;

import com.loc.electricity.application.dto.request.CreatePeriodRequest;
import com.loc.electricity.application.dto.request.UpdatePeriodRequest;
import com.loc.electricity.application.dto.response.ApiResponse;
import com.loc.electricity.application.dto.response.PeriodResponse;
import com.loc.electricity.application.dto.response.PeriodReviewResponse;
import com.loc.electricity.application.service.PeriodService;
import com.loc.electricity.domain.period.BillingPeriod;
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

@RestController
@RequestMapping("/api/periods")
@RequiredArgsConstructor
public class PeriodController {

    private final PeriodService periodService;
    private final PrintPackService printPackService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Page<PeriodResponse>>> list(
            @PageableDefault(size = 20, sort = "startDate") Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.ok(
                periodService.findAll(pageable).map(PeriodResponse::from)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<PeriodResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(PeriodResponse.from(periodService.findById(id))));
    }

    @GetMapping("/current")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<PeriodResponse>> getCurrent() {
        return ResponseEntity.ok(ApiResponse.ok(PeriodResponse.from(periodService.findCurrent())));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<PeriodResponse>> create(
            @Valid @RequestBody CreatePeriodRequest request,
            @CurrentUser User currentUser) {
        PeriodResponse response = PeriodResponse.from(periodService.createPeriod(request, currentUser));
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(response));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<PeriodResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody UpdatePeriodRequest request,
            @CurrentUser User currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(
                PeriodResponse.from(periodService.update(id, request, currentUser))));
    }

    @GetMapping("/{id}/review")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<PeriodReviewResponse>> review(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(periodService.review(id)));
    }

    @PostMapping("/{id}/calculate")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<PeriodResponse>> calculate(
            @PathVariable Long id,
            @CurrentUser User currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(
                PeriodResponse.from(periodService.calculate(id, currentUser))));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<PeriodResponse>> approve(
            @PathVariable Long id,
            @CurrentUser User currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(
                PeriodResponse.from(periodService.approve(id, currentUser))));
    }

    @PostMapping("/{id}/revert")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<PeriodResponse>> revert(
            @PathVariable Long id,
            @CurrentUser User currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(
                PeriodResponse.from(periodService.revert(id, currentUser))));
    }

    @PostMapping("/{id}/close")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<PeriodResponse>> close(
            @PathVariable Long id,
            @CurrentUser User currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(
                PeriodResponse.from(periodService.close(id, currentUser))));
    }

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
