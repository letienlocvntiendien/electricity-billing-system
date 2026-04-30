package com.loc.electricity.application.service;

import com.loc.electricity.application.exception.BusinessException;
import com.loc.electricity.domain.bill.BillStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Service
public class CalculationEngine {

    public record ReadingInput(Long customerId, Long readingId, int consumption) {}

    public record BillOutput(
            Long customerId,
            Long readingId,
            int consumption,
            BigDecimal unitPrice,
            BigDecimal serviceUnitPrice,
            BigDecimal electricityAmount,
            BigDecimal serviceAmount,
            BigDecimal totalAmount,
            BillStatus status
    ) {}

    public record CalculationOutput(BigDecimal unitPrice, List<BillOutput> bills) {}

    public CalculationOutput calculate(
            BigDecimal evnTotalAmount,
            BigDecimal extraFee,
            BigDecimal serviceUnitPrice,
            List<ReadingInput> readings
    ) {
        int totalConsumption = readings.stream().mapToInt(ReadingInput::consumption).sum();

        if (totalConsumption == 0) {
            throw new BusinessException("ZERO_CONSUMPTION",
                    "Total consumption is zero; cannot calculate unit price");
        }

        BigDecimal unitPrice = evnTotalAmount.add(extraFee)
                .divide(new BigDecimal(totalConsumption), 0, RoundingMode.HALF_UP);

        List<BillOutput> bills = readings.stream().map(r -> {
            BigDecimal electricity = unitPrice.multiply(new BigDecimal(r.consumption()));
            BigDecimal service = serviceUnitPrice.multiply(new BigDecimal(r.consumption()));
            BigDecimal total = electricity.add(service);
            BillStatus status = total.compareTo(BigDecimal.ZERO) == 0
                    ? BillStatus.PAID
                    : BillStatus.PENDING;
            return new BillOutput(r.customerId(), r.readingId(), r.consumption(),
                    unitPrice, serviceUnitPrice, electricity, service, total, status);
        }).toList();

        return new CalculationOutput(unitPrice, bills);
    }
}
