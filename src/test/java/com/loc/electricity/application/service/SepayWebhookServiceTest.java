package com.loc.electricity.application.service;

import com.loc.electricity.TestFixtures;
import com.loc.electricity.domain.bill.Bill;
import com.loc.electricity.domain.bill.BillStatus;
import com.loc.electricity.domain.customer.Customer;
import com.loc.electricity.domain.payment.Payment;
import com.loc.electricity.domain.period.BillingPeriod;
import com.loc.electricity.domain.period.PeriodStatus;
import com.loc.electricity.infrastructure.persistence.BillRepository;
import com.loc.electricity.infrastructure.persistence.BillingPeriodRepository;
import com.loc.electricity.infrastructure.persistence.CustomerRepository;
import com.loc.electricity.infrastructure.persistence.PaymentRepository;
import com.loc.electricity.infrastructure.persistence.UserRepository;
import com.loc.electricity.infrastructure.webhook.SepayWebhookPayload;
import com.loc.electricity.infrastructure.webhook.SepayWebhookService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SepayWebhookServiceTest {

    @Autowired SepayWebhookService sepayWebhookService;
    @Autowired BillRepository billRepository;
    @Autowired PaymentRepository paymentRepository;
    @Autowired BillingPeriodRepository billingPeriodRepository;
    @Autowired CustomerRepository customerRepository;
    @Autowired UserRepository userRepository;

    // Bill for KH001 in period 2026-05 → paymentCode = "TIENDIEN 2026-05 KH001"
    private static final String PAYMENT_CODE = "TIENDIEN 2026-05 KH001";
    private Bill bill;

    @BeforeEach
    void setUp() {
        userRepository.save(TestFixtures.admin());
        Customer customer = customerRepository.save(TestFixtures.customer("KH001", "Nguyen Van A"));
        BillingPeriod period = billingPeriodRepository.save(
                TestFixtures.openPeriod("2026-05", LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31)));
        period.setStatus(PeriodStatus.APPROVED);
        billingPeriodRepository.save(period);
        bill = billRepository.save(TestFixtures.bill(period, customer, new BigDecimal("478000"), BillStatus.PENDING));
    }

    @Test
    void shouldIgnoreTransferTypeOut() {
        SepayWebhookPayload payload = buildPayload(1L, "out", PAYMENT_CODE, new BigDecimal("478000"));

        sepayWebhookService.handleWebhook(payload);

        assertThat(paymentRepository.count()).isZero();
    }

    @Test
    void shouldMatchPaymentCodeToBillAndRecordPayment() {
        SepayWebhookPayload payload = buildPayload(2L, "in", PAYMENT_CODE, new BigDecimal("478000"));

        sepayWebhookService.handleWebhook(payload);

        assertThat(paymentRepository.count()).isEqualTo(1);
        Payment payment = paymentRepository.findAll().get(0);
        assertThat(payment.getBill()).isNotNull();
        assertThat(payment.getBill().getId()).isEqualTo(bill.getId());
    }

    @Test
    void shouldMatchPaymentCodeCaseInsensitively() {
        String lowercaseCode = PAYMENT_CODE.toLowerCase();
        SepayWebhookPayload payload = buildPayload(3L, "in", lowercaseCode, new BigDecimal("478000"));

        sepayWebhookService.handleWebhook(payload);

        assertThat(paymentRepository.count()).isEqualTo(1);
        assertThat(paymentRepository.findAll().get(0).getBill()).isNotNull();
    }

    @Test
    void shouldNotCreateDuplicatePaymentForSameSepayId() {
        SepayWebhookPayload payload = buildPayload(4L, "in", PAYMENT_CODE, new BigDecimal("100000"));

        sepayWebhookService.handleWebhook(payload);
        sepayWebhookService.handleWebhook(payload);

        assertThat(paymentRepository.count()).isEqualTo(1);
    }

    @Test
    void shouldCreateUnmatchedPaymentWhenCodeNotRecognized() {
        SepayWebhookPayload payload = buildPayload(5L, "in", "RANDOM CONTENT NO CODE", new BigDecimal("100000"));

        sepayWebhookService.handleWebhook(payload);

        assertThat(paymentRepository.count()).isEqualTo(1);
        assertThat(paymentRepository.findAll().get(0).getBill()).isNull();
    }

    @Test
    void shouldSetBillToPartialWhenAmountInsufficient() {
        SepayWebhookPayload payload = buildPayload(6L, "in", PAYMENT_CODE, new BigDecimal("200000"));

        sepayWebhookService.handleWebhook(payload);

        Bill updated = billRepository.findById(bill.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(BillStatus.PARTIAL);
        assertThat(updated.getPaidAmount()).isEqualByComparingTo("200000");
    }

    @Test
    void shouldSetBillToPaidWhenAmountSufficient() {
        SepayWebhookPayload payload = buildPayload(7L, "in", PAYMENT_CODE, new BigDecimal("478000"));

        sepayWebhookService.handleWebhook(payload);

        Bill updated = billRepository.findById(bill.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(BillStatus.PAID);
        assertThat(updated.getPaidAmount()).isEqualByComparingTo("478000");
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private SepayWebhookPayload buildPayload(Long id, String transferType,
                                             String content, BigDecimal amount) {
        SepayWebhookPayload payload = new SepayWebhookPayload();
        payload.setId(id);
        payload.setTransferType(transferType);
        payload.setContent(content);
        payload.setTransferAmount(amount);
        payload.setTransactionDate("2026-05-15 10:00:00");
        payload.setReferenceCode("REF-" + id);
        return payload;
    }
}
