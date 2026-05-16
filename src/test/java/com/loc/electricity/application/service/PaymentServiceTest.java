package com.loc.electricity.application.service;

import com.loc.electricity.TestFixtures;
import com.loc.electricity.application.dto.request.AssignPaymentRequest;
import com.loc.electricity.application.dto.request.CreatePaymentRequest;
import com.loc.electricity.application.exception.BusinessException;
import com.loc.electricity.domain.bill.Bill;
import com.loc.electricity.domain.bill.BillStatus;
import com.loc.electricity.domain.customer.Customer;
import com.loc.electricity.domain.payment.Payment;
import com.loc.electricity.domain.payment.PaymentMethod;
import com.loc.electricity.domain.period.BillingPeriod;
import com.loc.electricity.domain.period.PeriodStatus;
import com.loc.electricity.domain.user.User;
import com.loc.electricity.infrastructure.persistence.BillRepository;
import com.loc.electricity.infrastructure.persistence.BillingPeriodRepository;
import com.loc.electricity.infrastructure.persistence.CustomerRepository;
import com.loc.electricity.infrastructure.persistence.PaymentRepository;
import com.loc.electricity.infrastructure.persistence.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PaymentServiceTest {

    @Autowired PaymentService paymentService;
    @Autowired BillRepository billRepository;
    @Autowired PaymentRepository paymentRepository;
    @Autowired BillingPeriodRepository billingPeriodRepository;
    @Autowired CustomerRepository customerRepository;
    @Autowired UserRepository userRepository;

    private User admin;
    private Bill bill;

    @BeforeEach
    void setUp() {
        admin = userRepository.save(TestFixtures.admin());
        Customer customer = customerRepository.save(TestFixtures.customer("KH001", "Nguyen Van A"));
        BillingPeriod period = billingPeriodRepository.save(
                TestFixtures.openPeriod("2026-05", LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31)));
        period.setStatus(PeriodStatus.CALCULATED);
        billingPeriodRepository.save(period);
        bill = billRepository.save(TestFixtures.bill(period, customer, new BigDecimal("478000"), BillStatus.PENDING));
    }

    @Test
    void shouldTransitionBillToPartialAfterPartialPayment() {
        recordManualPayment(new BigDecimal("200000"));

        Bill updated = billRepository.findById(bill.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(BillStatus.PARTIAL);
        assertThat(updated.getPaidAmount()).isEqualByComparingTo("200000");
    }

    @Test
    void shouldTransitionBillToPaidAfterFullPayment() {
        recordManualPayment(new BigDecimal("478000"));

        Bill updated = billRepository.findById(bill.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(BillStatus.PAID);
        assertThat(updated.getPaidAmount()).isEqualByComparingTo("478000");
    }

    @Test
    void shouldTransitionBillToPaidAfterOverpayment() {
        recordManualPayment(new BigDecimal("500000"));

        Bill updated = billRepository.findById(bill.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(BillStatus.PAID);
    }

    @Test
    void shouldRejectPaymentWhenBillAlreadyPaid() {
        bill.setStatus(BillStatus.PAID);
        billRepository.save(bill);

        assertThatThrownBy(() -> recordManualPayment(new BigDecimal("100000")))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getCode())
                        .isEqualTo("BILL_ALREADY_PAID"));
    }

    @Test
    void shouldUpdateBillStatusWhenAssigningUnmatchedPayment() {
        Payment unmatched = paymentRepository.save(TestFixtures.unmatchedBankTransfer(
                new BigDecimal("300000"), "BANK-TXN-001"));

        paymentService.assignPayment(unmatched.getId(), new AssignPaymentRequest(bill.getId()), admin);

        Bill updated = billRepository.findById(bill.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(BillStatus.PARTIAL);
        assertThat(updated.getPaidAmount()).isEqualByComparingTo("300000");
    }

    @Test
    void shouldRejectAssignmentOfAlreadyAssignedPayment() {
        Payment assigned = paymentRepository.save(
                Payment.builder()
                        .bill(bill)
                        .amount(new BigDecimal("100000"))
                        .method(PaymentMethod.BANK_TRANSFER)
                        .paidAt(LocalDateTime.now())
                        .bankTransactionId("BANK-TXN-002")
                        .build());

        assertThatThrownBy(() ->
                paymentService.assignPayment(assigned.getId(), new AssignPaymentRequest(bill.getId()), admin))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getCode())
                        .isEqualTo("PAYMENT_ALREADY_ASSIGNED"));
    }

    private Payment recordManualPayment(BigDecimal amount) {
        return paymentService.createManualPayment(
                bill.getId(),
                new CreatePaymentRequest(amount, PaymentMethod.CASH, LocalDateTime.now(), null),
                admin);
    }
}
