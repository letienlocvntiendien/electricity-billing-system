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

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    @GetMapping("/debt")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<List<BillResponse>>> debtReport() {
        List<BillResponse> response = reportService.getDebtReport()
                .stream().map(BillResponse::from).toList();
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/period/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ACCOUNTANT')")
    public ResponseEntity<ApiResponse<PeriodSummaryResponse>> periodSummary(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(reportService.getPeriodSummary(id)));
    }
}
