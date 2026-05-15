package com.loc.electricity.application.service;

import com.loc.electricity.application.exception.BusinessException;
import com.loc.electricity.domain.bill.BillStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * Stateless billing calculation engine implementing the Spec V2 formula.
 *
 * <p>Formula:
 * <pre>
 *   unit_price         = (evnTotalAmount + extraFee) / totalConsumption  [HALF_UP, 2 decimals]
 *   electricityAmount  = unit_price × consumption                        [HALF_UP, 0 decimals]
 *   serviceAmount      = serviceFee                                      [flat per household]
 *   totalAmount        = electricityAmount + serviceAmount
 * </pre>
 */
@Service
public class CalculationEngine {

    public record ReadingInput(Long customerId, Long readingId, int consumption) {}

    public record BillOutput(
            Long customerId,
            Long readingId,
            int consumption,
            BigDecimal unitPrice,
            BigDecimal serviceFee,
            BigDecimal electricityAmount,
            BigDecimal serviceAmount,
            BigDecimal totalAmount,
            BillStatus status
    ) {}

    public record CalculationOutput(BigDecimal unitPrice, List<BillOutput> bills) {}

    /**
     * Computes unit price and individual bill amounts for a set of meter readings.
     * Bills with a zero total amount are automatically set to PAID status.
     *
     * @param evnTotalAmount total amount on the EVN master invoice
     * @param extraFee       additional overhead fee added to the EVN amount before dividing
     * @param serviceFee     flat service fee applied per household (not per kWh)
     * @param readings       submitted readings for each customer
     * @return the computed unit price and per-customer bill breakdown
     * @throws com.loc.electricity.application.exception.BusinessException if total consumption across all readings is zero
     */
    public CalculationOutput calculate(
            BigDecimal evnTotalAmount,
            BigDecimal extraFee,
            BigDecimal serviceFee,
            List<ReadingInput> readings
    ) {
        int totalConsumption = readings.stream().mapToInt(ReadingInput::consumption).sum();

        if (totalConsumption == 0) {
            throw new BusinessException("ZERO_CONSUMPTION",
                    "Tất cả KH đều có consumption=0, không thể tính đơn giá.");
        }

        BigDecimal unitPrice = evnTotalAmount.add(extraFee)
                .divide(new BigDecimal(totalConsumption), 2, RoundingMode.HALF_UP);

        List<BillOutput> bills = readings.stream().map(r -> {
            BigDecimal electricity = unitPrice.multiply(new BigDecimal(r.consumption()))
                    .setScale(0, RoundingMode.HALF_UP);
            // service_amount = service_fee (flat, not multiplied by consumption)
            BigDecimal service = serviceFee;
            BigDecimal total = electricity.add(service);
            BillStatus status = total.compareTo(BigDecimal.ZERO) == 0
                    ? BillStatus.PAID
                    : BillStatus.PENDING;
            return new BillOutput(r.customerId(), r.readingId(), r.consumption(),
                    unitPrice, serviceFee, electricity, service, total, status);
        }).toList();

        return new CalculationOutput(unitPrice, bills);
    }
}
