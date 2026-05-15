package com.loc.electricity.application.service;

import com.loc.electricity.application.dto.response.PeriodSummaryResponse;
import com.loc.electricity.application.exception.ResourceNotFoundException;
import com.loc.electricity.domain.bill.Bill;
import com.loc.electricity.domain.bill.BillStatus;
import com.loc.electricity.domain.period.BillingPeriod;
import com.loc.electricity.infrastructure.persistence.BillRepository;
import com.loc.electricity.infrastructure.persistence.BillingPeriodRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Provides financial reporting data across billing periods.
 */
@Service
@RequiredArgsConstructor
public class ReportService {

    private final BillRepository billRepository;
    private final BillingPeriodRepository billingPeriodRepository;

    /**
     * Returns all unpaid bills across all periods with status PENDING, SENT, PARTIAL, or OVERDUE.
     *
     * @return list of unpaid bills
     */
    public List<Bill> getDebtReport() {
        return billRepository.findUnpaidBills(
                List.of(BillStatus.PENDING, BillStatus.SENT, BillStatus.PARTIAL, BillStatus.OVERDUE));
    }

    /**
     * Returns a financial summary for the given period, including total billed, total collected,
     * outstanding balance, bill counts by status, and the rounding difference from EVN totals.
     *
     * @param periodId the billing period ID
     * @return the period summary
     * @throws com.loc.electricity.application.exception.ResourceNotFoundException if the period is not found
     */
    public PeriodSummaryResponse getPeriodSummary(Long periodId) {
        BillingPeriod period = billingPeriodRepository.findById(periodId)
                .orElseThrow(() -> new ResourceNotFoundException("BillingPeriod", periodId));

        List<Bill> bills = billRepository.findAllByPeriodId(periodId);

        BigDecimal totalBilled = bills.stream()
                .map(Bill::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalPaid = bills.stream()
                .map(Bill::getPaidAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<BillStatus, Long> countByStatus = bills.stream()
                .collect(Collectors.groupingBy(Bill::getStatus, Collectors.counting()));

        // Rounding diff = (evnTotal + extraFee) − sum of electricity amounts billed
        BigDecimal sumElectricity = bills.stream()
                .map(Bill::getElectricityAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal roundingDiff = period.getEvnTotalAmount()
                .add(period.getExtraFee())
                .subtract(sumElectricity);

        return new PeriodSummaryResponse(
                period.getId(), period.getCode(), period.getName(),
                bills.size(), totalBilled, totalPaid,
                totalBilled.subtract(totalPaid),
                countByStatus, roundingDiff);
    }
}
