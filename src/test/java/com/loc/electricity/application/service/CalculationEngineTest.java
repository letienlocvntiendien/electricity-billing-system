package com.loc.electricity.application.service;

import com.loc.electricity.application.exception.BusinessException;
import com.loc.electricity.domain.bill.BillStatus;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CalculationEngineTest {

    private final CalculationEngine engine = new CalculationEngine();

    @Test
    void shouldCalculateUnitPriceAsEvnAmountPlusExtraFeeOverTotalConsumption() {
        // 4_290_000 / 2750 = 1560.00
        var result = engine.calculate(
                new BigDecimal("4290000"), BigDecimal.ZERO, new BigDecimal("10000"),
                List.of(new CalculationEngine.ReadingInput(1L, 1L, 2750)));

        assertThat(result.unitPrice()).isEqualByComparingTo("1560.00");
    }

    @Test
    void shouldIncludeExtraFeeInUnitPriceNumerator() {
        // (4_000_000 + 290_000) / 2750 = 1560.00
        var result = engine.calculate(
                new BigDecimal("4000000"), new BigDecimal("290000"), new BigDecimal("10000"),
                List.of(new CalculationEngine.ReadingInput(1L, 1L, 2750)));

        assertThat(result.unitPrice()).isEqualByComparingTo("1560.00");
    }

    @Test
    void shouldRoundUnitPriceHalfUpToTwoDecimals() {
        // 100 / 3 = 33.333... → HALF_UP → 33.33
        var result = engine.calculate(
                new BigDecimal("100"), BigDecimal.ZERO, BigDecimal.ZERO,
                List.of(new CalculationEngine.ReadingInput(1L, 1L, 3)));

        assertThat(result.unitPrice()).isEqualByComparingTo("33.33");
    }

    @Test
    void shouldRoundElectricityAmountHalfUpToZeroDecimals() {
        // unitPrice = 100/3 = 33.33, consumption=2 → 66.66 → HALF_UP → 67
        var result = engine.calculate(
                new BigDecimal("100"), BigDecimal.ZERO, BigDecimal.ZERO,
                List.of(
                        new CalculationEngine.ReadingInput(1L, 1L, 1),
                        new CalculationEngine.ReadingInput(2L, 2L, 2)));

        // Bill for consumption=2: 33.33 × 2 = 66.66 → rounds to 67
        var bill2 = result.bills().stream()
                .filter(b -> b.consumption() == 2).findFirst().orElseThrow();
        assertThat(bill2.electricityAmount()).isEqualByComparingTo("67");
    }

    @Test
    void shouldApplyServiceFeeAsFlatAmountPerHousehold() {
        // serviceFee = 10_000 flat per household, NOT multiplied by consumption
        var result = engine.calculate(
                new BigDecimal("3000"), BigDecimal.ZERO, new BigDecimal("10000"),
                List.of(
                        new CalculationEngine.ReadingInput(1L, 1L, 100),
                        new CalculationEngine.ReadingInput(2L, 2L, 200)));

        assertThat(result.bills()).allSatisfy(b ->
                assertThat(b.serviceAmount()).isEqualByComparingTo("10000"));
    }

    @Test
    void shouldMarkBillAsPaidWhenTotalAmountIsZero() {
        // evnAmount=0, serviceFee=0 → total=0 → status PAID
        var result = engine.calculate(
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                List.of(new CalculationEngine.ReadingInput(1L, 1L, 100)));

        assertThat(result.bills().get(0).status()).isEqualTo(BillStatus.PAID);
        assertThat(result.bills().get(0).totalAmount()).isEqualByComparingTo("0");
    }

    @Test
    void shouldThrowWhenTotalConsumptionIsZero() {
        assertThatThrownBy(() ->
                engine.calculate(
                        new BigDecimal("1000"), BigDecimal.ZERO, BigDecimal.ZERO,
                        List.of(new CalculationEngine.ReadingInput(1L, 1L, 0))))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getCode()).isEqualTo("ZERO_CONSUMPTION"));
    }

    @Test
    void shouldComputeTotalAmountAsElectricityPlusServiceAmount() {
        // totalConsumption=2750 → unitPrice=1560; bill with consumption=300: 1560×300=468000 + 10000 = 478000
        var result = engine.calculate(
                new BigDecimal("4290000"), BigDecimal.ZERO, new BigDecimal("10000"),
                List.of(
                        new CalculationEngine.ReadingInput(1L, 1L, 2450),
                        new CalculationEngine.ReadingInput(2L, 2L, 300)));

        var bill = result.bills().stream().filter(b -> b.consumption() == 300).findFirst().orElseThrow();
        assertThat(bill.electricityAmount()).isEqualByComparingTo("468000");
        assertThat(bill.serviceAmount()).isEqualByComparingTo("10000");
        assertThat(bill.totalAmount()).isEqualByComparingTo("478000");
    }
}
