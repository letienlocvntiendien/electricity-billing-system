package com.loc.electricity.application.service;

import com.loc.electricity.TestFixtures;
import com.loc.electricity.domain.bill.Bill;
import com.loc.electricity.domain.bill.BillStatus;
import com.loc.electricity.domain.customer.Customer;
import com.loc.electricity.domain.period.BillingPeriod;
import com.loc.electricity.domain.period.PeriodStatus;
import com.loc.electricity.infrastructure.pdf.PdfBillData;
import com.loc.electricity.infrastructure.pdf.PdfGenerationService;
import com.loc.electricity.infrastructure.persistence.BillRepository;
import com.loc.electricity.infrastructure.persistence.BillingPeriodRepository;
import com.loc.electricity.infrastructure.persistence.CustomerRepository;
import com.loc.electricity.infrastructure.persistence.UserRepository;
import com.loc.electricity.infrastructure.qr.VietQrService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.core.task.SyncTaskExecutor;
import org.springframework.core.task.TaskExecutor;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@org.springframework.test.context.TestPropertySource(properties = "spring.main.allow-bean-definition-overriding=true")
class BillGenerationServiceTest {

    // Run async tasks synchronously so assertions can run immediately after generation.
    @TestConfiguration
    static class SyncExecutorConfig {
        @Bean
        @Primary
        TaskExecutor pdfTaskExecutor() {
            return new SyncTaskExecutor();
        }
    }

    @MockitoBean VietQrService vietQrService;
    @MockitoBean PdfGenerationService pdfGenerationService;

    @Autowired BillGenerationService billGenerationService;
    @Autowired BillRepository billRepository;
    @Autowired BillingPeriodRepository billingPeriodRepository;
    @Autowired CustomerRepository customerRepository;
    @Autowired UserRepository userRepository;

    private BillingPeriod period;

    @BeforeEach
    void setUp() throws Exception {
        userRepository.save(TestFixtures.admin());
        Customer customer = customerRepository.save(TestFixtures.customer("KH001", "Nguyen Van A"));
        period = billingPeriodRepository.save(
                TestFixtures.openPeriod("2026-05", LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31)));
        period.setStatus(PeriodStatus.APPROVED);
        billingPeriodRepository.save(period);
        billRepository.save(TestFixtures.bill(period, customer, new BigDecimal("478000"), BillStatus.PENDING));

        when(vietQrService.buildQrUrl(anyString(), any(BigDecimal.class)))
                .thenReturn("https://qr.test/fake-qr-url");
        when(pdfGenerationService.generateAndStore(any(Bill.class), anyString(), any(PdfBillData.class)))
                .thenReturn("bills/test-bill.pdf");
    }

    @Test
    void shouldSetQrCodeUrlOnBillAfterGeneration() {
        billGenerationService.regenerateForPeriod(period.getId());

        Bill updated = billRepository.findAllByPeriodId(period.getId()).get(0);
        assertThat(updated.getQrCodeUrl()).isEqualTo("https://qr.test/fake-qr-url");
    }

    @Test
    void shouldSetPdfUrlOnBillAfterGeneration() {
        billGenerationService.regenerateForPeriod(period.getId());

        Bill updated = billRepository.findAllByPeriodId(period.getId()).get(0);
        assertThat(updated.getPdfUrl()).isEqualTo("bills/test-bill.pdf");
    }

    @Test
    void shouldTransitionBillFromPendingToSent() {
        billGenerationService.regenerateForPeriod(period.getId());

        Bill updated = billRepository.findAllByPeriodId(period.getId()).get(0);
        assertThat(updated.getStatus()).isEqualTo(BillStatus.SENT);
    }

    @Test
    void shouldContinueGeneratingOtherBillsIfOneFails() throws Exception {
        // Add a second customer and bill
        Customer customer2 = customerRepository.save(TestFixtures.customer("KH002", "Tran Thi B"));
        Bill bill2 = billRepository.save(TestFixtures.bill(period, customer2, new BigDecimal("300000"), BillStatus.PENDING));

        // First call to generateAndStore throws; second succeeds
        doThrow(new RuntimeException("PDF generation failed"))
                .doReturn("bills/test-bill2.pdf")
                .when(pdfGenerationService).generateAndStore(any(Bill.class), anyString(), any(PdfBillData.class));

        billGenerationService.regenerateForPeriod(period.getId());

        List<Bill> bills = billRepository.findAllByPeriodId(period.getId());
        long sentCount = bills.stream().filter(b -> b.getStatus() == BillStatus.SENT).count();
        // One failed, one should have been processed successfully
        assertThat(sentCount).isGreaterThanOrEqualTo(1);
    }
}
