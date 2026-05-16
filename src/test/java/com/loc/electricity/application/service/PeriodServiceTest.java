package com.loc.electricity.application.service;

import com.loc.electricity.TestFixtures;
import com.loc.electricity.application.dto.request.CreatePeriodRequest;
import com.loc.electricity.application.exception.BusinessException;
import com.loc.electricity.domain.bill.Bill;
import com.loc.electricity.domain.bill.BillStatus;
import com.loc.electricity.domain.customer.Customer;
import com.loc.electricity.domain.period.BillingPeriod;
import com.loc.electricity.domain.period.PeriodStatus;
import com.loc.electricity.domain.reading.MeterReading;
import com.loc.electricity.domain.user.User;
import com.loc.electricity.infrastructure.persistence.BillRepository;
import com.loc.electricity.infrastructure.persistence.BillingPeriodRepository;
import com.loc.electricity.infrastructure.persistence.CustomerRepository;
import com.loc.electricity.infrastructure.persistence.EvnInvoiceRepository;
import com.loc.electricity.infrastructure.persistence.MeterReadingRepository;
import com.loc.electricity.infrastructure.persistence.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PeriodServiceTest {

    @Autowired PeriodService periodService;
    @Autowired BillingPeriodRepository billingPeriodRepository;
    @Autowired CustomerRepository customerRepository;
    @Autowired UserRepository userRepository;
    @Autowired EvnInvoiceRepository evnInvoiceRepository;
    @Autowired MeterReadingRepository meterReadingRepository;
    @Autowired BillRepository billRepository;

    private User admin;
    private User accountant;
    private User reader;
    private Customer customer;

    @BeforeEach
    void setUp() {
        admin = userRepository.save(TestFixtures.admin());
        accountant = userRepository.save(TestFixtures.accountant());
        reader = userRepository.save(TestFixtures.meterReader());
        customer = customerRepository.save(TestFixtures.customer("KH001", "Nguyen Van A"));
    }

    @Test
    void shouldCreateMeterReadingSlotsForActiveCustomersWhenPeriodCreated() {
        var request = new CreatePeriodRequest(
                "May 2026",
                LocalDate.of(2026, 5, 1),
                LocalDate.of(2026, 5, 31),
                new BigDecimal("10000"));

        BillingPeriod period = periodService.createPeriod(request, admin);

        List<MeterReading> readings = meterReadingRepository.findAllByPeriodId(period.getId());
        assertThat(readings).hasSize(1);
        assertThat(readings.get(0).getCustomer().getCode()).isEqualTo("KH001");
    }

    @Test
    void shouldFailCalculateWhenPeriodNotInReadingDone() {
        BillingPeriod period = saveOpenPeriod("2026-04");

        assertThatThrownBy(() -> periodService.calculate(period.getId(), accountant))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getCode())
                        .isEqualTo("INVALID_STATE_TRANSITION"));
    }

    @Test
    void shouldFailCalculateWhenNoEvnInvoice() {
        BillingPeriod period = saveOpenPeriod("2026-04");
        period.setStatus(PeriodStatus.READING_DONE);
        billingPeriodRepository.save(period);
        saveSubmittedReading(period);

        assertThatThrownBy(() -> periodService.calculate(period.getId(), accountant))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getCode())
                        .isEqualTo("NO_EVN_INVOICE"));
    }

    @Test
    void shouldTransitionToCalculatedWhenAllConditionsMet() {
        BillingPeriod period = prepareReadingDonePeriod("2026-04");

        BillingPeriod calculated = periodService.calculate(period.getId(), accountant);

        assertThat(calculated.getStatus()).isEqualTo(PeriodStatus.CALCULATED);
        assertThat(calculated.getUnitPrice()).isNotNull().isPositive();

        List<Bill> bills = billRepository.findAllByPeriodId(period.getId());
        assertThat(bills).hasSize(1);
        assertThat(bills.get(0).getStatus()).isEqualTo(BillStatus.PENDING);
    }

    @Test
    void shouldSetAccountantVerifiedAtOnVerify() {
        BillingPeriod period = prepareCalculatedPeriod("2026-04");

        BillingPeriod verified = periodService.verify(period.getId(), accountant);

        assertThat(verified.getAccountantVerifiedAt()).isNotNull();
        assertThat(verified.getAccountantVerifiedBy().getId()).isEqualTo(accountant.getId());
    }

    @Test
    void shouldFailApproveWhenNotVerified() {
        BillingPeriod period = prepareCalculatedPeriod("2026-04");

        assertThatThrownBy(() -> periodService.approve(period.getId(), admin))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getCode())
                        .isEqualTo("NOT_VERIFIED"));
    }

    @Test
    void shouldTransitionToApprovedAfterVerification() {
        BillingPeriod period = prepareCalculatedPeriod("2026-04");
        periodService.verify(period.getId(), accountant);

        BillingPeriod approved = periodService.approve(period.getId(), admin);

        assertThat(approved.getStatus()).isEqualTo(PeriodStatus.APPROVED);
        assertThat(approved.getApprovedAt()).isNotNull();
        assertThat(approved.getApprovedBy().getId()).isEqualTo(admin.getId());
    }

    @Test
    void shouldFailCloseWhenBillsNotPaid() {
        BillingPeriod period = prepareApprovedPeriod("2026-04");

        assertThatThrownBy(() -> periodService.close(period.getId(), admin))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getCode())
                        .isEqualTo("UNPAID_BILLS"));
    }

    @Test
    void shouldTransitionToClosedWhenAllBillsPaid() {
        BillingPeriod period = prepareApprovedPeriod("2026-04");
        markAllBillsPaid(period);

        BillingPeriod closed = periodService.close(period.getId(), admin);

        assertThat(closed.getStatus()).isEqualTo(PeriodStatus.CLOSED);
        assertThat(closed.getClosedAt()).isNotNull();
    }

    @Test
    void shouldRevertFromCalculatedDeleteBillsAndClearFields() {
        BillingPeriod period = prepareCalculatedPeriod("2026-04");

        BillingPeriod reverted = periodService.revert(period.getId(), admin);

        assertThat(reverted.getStatus()).isEqualTo(PeriodStatus.OPEN);
        assertThat(reverted.getUnitPrice()).isNull();
        assertThat(reverted.getAccountantVerifiedAt()).isNull();
        assertThat(reverted.getApprovedAt()).isNull();
        assertThat(billRepository.findAllByPeriodId(period.getId())).isEmpty();
    }

    @Test
    void shouldRevertFromApprovedClearApprovalFields() {
        BillingPeriod period = prepareApprovedPeriod("2026-04");

        BillingPeriod reverted = periodService.revert(period.getId(), admin);

        assertThat(reverted.getStatus()).isEqualTo(PeriodStatus.OPEN);
        assertThat(reverted.getApprovedAt()).isNull();
        assertThat(reverted.getApprovedBy()).isNull();
        assertThat(reverted.getAccountantVerifiedAt()).isNull();
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private BillingPeriod saveOpenPeriod(String code) {
        return billingPeriodRepository.save(
                TestFixtures.openPeriod(code, LocalDate.of(2026, 4, 1), LocalDate.of(2026, 4, 30)));
    }

    private void saveSubmittedReading(BillingPeriod period) {
        meterReadingRepository.save(
                TestFixtures.submittedReading(period, customer, 100, 400, reader));
    }

    private void saveEvnInvoice(BillingPeriod period, int kwh, BigDecimal amount) {
        evnInvoiceRepository.save(TestFixtures.evnInvoice(period, kwh, amount));
        // Sync period totals manually (mirrors EvnInvoiceService.syncPeriodTotals)
        period.setEvnTotalAmount(amount);
        period.setEvnTotalKwh(kwh);
        billingPeriodRepository.save(period);
    }

    // Returns a READING_DONE period with one EVN invoice and one submitted reading.
    private BillingPeriod prepareReadingDonePeriod(String code) {
        BillingPeriod period = saveOpenPeriod(code);
        period.setStatus(PeriodStatus.READING_DONE);
        period = billingPeriodRepository.save(period);
        saveEvnInvoice(period, 2750, new BigDecimal("4290000"));
        saveSubmittedReading(period);
        return period;
    }

    // Returns a CALCULATED period with one bill.
    private BillingPeriod prepareCalculatedPeriod(String code) {
        BillingPeriod period = prepareReadingDonePeriod(code);
        return periodService.calculate(period.getId(), accountant);
    }

    // Returns an APPROVED period (verified + approved) with one bill.
    private BillingPeriod prepareApprovedPeriod(String code) {
        BillingPeriod period = prepareCalculatedPeriod(code);
        periodService.verify(period.getId(), accountant);
        return periodService.approve(period.getId(), admin);
    }

    private void markAllBillsPaid(BillingPeriod period) {
        List<Bill> bills = billRepository.findAllByPeriodId(period.getId());
        bills.forEach(b -> {
            b.setStatus(BillStatus.PAID);
            b.setPaidAmount(b.getTotalAmount());
        });
        billRepository.saveAll(bills);
    }
}
