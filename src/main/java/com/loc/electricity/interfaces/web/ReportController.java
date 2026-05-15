package com.loc.electricity.interfaces.web;

import com.loc.electricity.application.dto.response.ApiResponse;
import com.loc.electricity.application.dto.response.BillResponse;
import com.loc.electricity.application.dto.response.PeriodSummaryResponse;
import com.loc.electricity.application.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for financial reporting. Roles: ADMIN, ACCOUNTANT.
 */
@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    /**
     * {@code GET /api/reports/debt} — Returns all unpaid bills across all periods
     * (status: PENDING, SENT, PARTIAL, OVERDUE).
     *
     * @return list of unpaid bills
     */
    @GetMapping("/debt")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<List<BillResponse>>> debtReport() {
        List<BillResponse> response = reportService.getDebtReport()
                .stream().map(BillResponse::from).toList();
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    /**
     * {@code GET /api/reports/period/{id}} — Returns a financial summary for the given billing period,
     * including total billed, collected, outstanding balance, bill counts by status, and rounding diff.
     *
     * @param id the billing period ID
     * @return the period financial summary
     */
    @GetMapping("/period/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<PeriodSummaryResponse>> periodSummary(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(reportService.getPeriodSummary(id)));
    }
}
