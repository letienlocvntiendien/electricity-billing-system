package com.loc.electricity.application.service;

import com.loc.electricity.application.dto.response.BillResponse;
import com.loc.electricity.application.dto.response.CustomerDebtSummaryResponse;
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
import java.util.Comparator;
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

    private static final List<BillStatus> UNPAID_STATUSES =
            List.of(BillStatus.PENDING, BillStatus.SENT, BillStatus.PARTIAL, BillStatus.OVERDUE);

    private static final Map<BillStatus, Integer> STATUS_PRIORITY = Map.of(
            BillStatus.PENDING, 1, BillStatus.SENT, 2, BillStatus.PARTIAL, 3, BillStatus.OVERDUE, 4);

    /**
     * Returns all unpaid bills across all periods with status PENDING, SENT, PARTIAL, or OVERDUE.
     *
     * @return list of unpaid bills
     */
    public List<Bill> getDebtReport() {
        return billRepository.findUnpaidBills(UNPAID_STATUSES);
    }

    /**
     * Returns a debt summary grouped by customer, sorted by total outstanding amount descending.
     * Each entry includes per-bill detail for drill-down and payment recording.
     *
     * @return list of customer debt summaries
     */
    public List<CustomerDebtSummaryResponse> getCustomerDebtSummaries() {
        List<Bill> unpaidBills = billRepository.findUnpaidBills(UNPAID_STATUSES);

        return unpaidBills.stream()
                .collect(Collectors.groupingBy(b -> b.getCustomer().getId()))
                .values().stream()
                .map(bills -> {
                    Bill anyBill = bills.get(0);

                    BigDecimal totalBilled = bills.stream()
                            .map(Bill::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
                    BigDecimal totalPaid = bills.stream()
                            .map(Bill::getPaidAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

                    String oldestPeriodName = bills.stream()
                            .min(Comparator.comparing(b -> b.getPeriod().getStartDate()))
                            .map(b -> b.getPeriod().getName())
                            .orElse("");

                    BillStatus worstStatus = bills.stream()
                            .max(Comparator.comparingInt(b -> STATUS_PRIORITY.getOrDefault(b.getStatus(), 0)))
                            .map(Bill::getStatus)
                            .orElse(BillStatus.PENDING);

                    List<BillResponse> billResponses = bills.stream()
                            .sorted(Comparator.comparing(b -> b.getPeriod().getStartDate()))
                            .map(BillResponse::from)
                            .toList();

                    return new CustomerDebtSummaryResponse(
                            anyBill.getCustomer().getId(),
                            anyBill.getCustomer().getCode(),
                            anyBill.getCustomer().getFullName(),
                            anyBill.getCustomer().getPhone(),
                            bills.size(),
                            oldestPeriodName,
                            totalBilled,
                            totalPaid,
                            totalBilled.subtract(totalPaid),
                            worstStatus,
                            billResponses);
                })
                .sorted(Comparator.comparing(CustomerDebtSummaryResponse::totalOutstanding).reversed())
                .toList();
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
