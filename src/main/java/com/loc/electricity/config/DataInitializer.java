package com.loc.electricity.config;

import com.loc.electricity.domain.bill.Bill;
import com.loc.electricity.domain.bill.BillStatus;
import com.loc.electricity.domain.customer.Customer;
import com.loc.electricity.domain.payment.Payment;
import com.loc.electricity.domain.payment.PaymentMethod;
import com.loc.electricity.domain.period.BillingPeriod;
import com.loc.electricity.domain.period.EvnInvoice;
import com.loc.electricity.domain.period.PeriodStatus;
import com.loc.electricity.domain.reading.MeterReading;
import com.loc.electricity.domain.user.Role;
import com.loc.electricity.domain.user.User;
import com.loc.electricity.infrastructure.persistence.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Seeds realistic dev data on first startup when the "dev" Spring profile is active.
 * Idempotent: skips entirely if the "admin" user already exists.
 *
 * Run with: ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
 *
 * Credentials seeded:
 *   admin       / Admin@123
 *   accountant  / Account@123
 *   reader      / Reader@123
 */
@Component
@Profile("dev")
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements ApplicationRunner {

    private final UserRepository userRepository;
    private final CustomerRepository customerRepository;
    private final BillingPeriodRepository billingPeriodRepository;
    private final EvnInvoiceRepository evnInvoiceRepository;
    private final MeterReadingRepository meterReadingRepository;
    private final BillRepository billRepository;
    private final PaymentRepository paymentRepository;
    private final SystemSettingRepository systemSettingRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (userRepository.findByUsername("admin").isPresent()) {
            log.info("[DataInitializer] Seed data already present — skipping.");
            return;
        }
        log.info("[DataInitializer] Seeding dev data...");

        User admin = userRepository.save(User.builder()
                .username("admin")
                .passwordHash(passwordEncoder.encode("Admin@123"))
                .fullName("Quản trị viên")
                .role(Role.ADMIN)
                .build());

        User accountant = userRepository.save(User.builder()
                .username("accountant")
                .passwordHash(passwordEncoder.encode("Account@123"))
                .fullName("Kế toán Nguyễn Thị Hoa")
                .role(Role.ACCOUNTANT)
                .build());

        User reader = userRepository.save(User.builder()
                .username("reader")
                .passwordHash(passwordEncoder.encode("Reader@123"))
                .fullName("Thợ đọc đồng hồ Trần Văn Minh")
                .role(Role.METER_READER)
                .build());

        List<Customer> customers = seedCustomers();
        seedSystemSettings();
        seedPeriod1(customers, admin, accountant, reader);
        seedPeriod2(customers, admin, accountant, reader);
        seedPeriod3(customers, reader);

        log.info("[DataInitializer] Dev seed complete — admin/Admin@123 · accountant/Account@123 · reader/Reader@123");
    }

    // ── Customers ────────────────────────────────────────────────────────────

    private List<Customer> seedCustomers() {
        Object[][] rows = {
            {"KH001", "Nguyễn Văn An",      "0901234501", "0901234501", "DK-001-A"},
            {"KH002", "Trần Thị Bình",       "0901234502", "0901234502", "DK-002-B"},
            {"KH003", "Lê Văn Cường",        "0901234503", "0901234503", "DK-003-C"},
            {"KH004", "Phạm Thị Dung",       "0901234504", "0912345504", "DK-004-D"},
            {"KH005", "Hoàng Văn Em",        "0901234505", "0901234505", "DK-005-E"},
            {"KH006", "Vũ Thị Phương",       "0901234506", "0901234506", "DK-006-F"},
            {"KH007", "Đỗ Văn Giang",        "0901234507",  null,        "DK-007-G"},
            {"KH008", "Ngô Thị Hoa",         "0901234508", "0901234508", "DK-008-H"},
            {"KH009", "Bùi Văn Inh",         "0901234509", "0901234509", "DK-009-I"},
            {"KH010", "Đinh Thị Kim",        "0901234510", "0912345510", "DK-010-K"},
        };
        List<Customer> result = new ArrayList<>();
        for (Object[] r : rows) {
            result.add(customerRepository.save(Customer.builder()
                    .code((String) r[0])
                    .fullName((String) r[1])
                    .phone((String) r[2])
                    .zaloPhone((String) r[3])
                    .meterSerial((String) r[4])
                    .build()));
        }
        return result;
    }

    // ── System settings ──────────────────────────────────────────────────────

    private void seedSystemSettings() {
        updateSetting("bank_account_number", "00012345678910");
        updateSetting("bank_account_holder", "NGUYEN VAN AN");
    }

    private void updateSetting(String key, String value) {
        systemSettingRepository.findById(key).ifPresent(s -> {
            s.setSettingValue(value);
            systemSettingRepository.save(s);
        });
    }

    // ── Period 1 — 2025-02 — CLOSED ──────────────────────────────────────────
    //
    //  EVN: 4819 kWh / 7,546,419 VND  →  unitPrice = round(7546419/4819) = 1566
    //  serviceUnitPrice = 500
    //  Status: CLOSED; 5 PAID · 3 PARTIAL · 2 OVERDUE

    private void seedPeriod1(List<Customer> customers, User admin, User accountant, User reader) {
        BigDecimal unitPrice    = new BigDecimal("1566");
        BigDecimal servicePrice = new BigDecimal("500");

        BillingPeriod p1 = billingPeriodRepository.save(BillingPeriod.builder()
                .code("2025-02")
                .name("Kỳ tháng 02/2025")
                .startDate(LocalDate.of(2025, 2, 1))
                .endDate(LocalDate.of(2025, 2, 28))
                .evnTotalAmount(new BigDecimal("7546419"))
                .evnTotalKwh(4819)
                .extraFee(BigDecimal.ZERO)
                .serviceUnitPrice(servicePrice)
                .unitPrice(unitPrice)
                .status(PeriodStatus.CLOSED)
                .approvedBy(admin)
                .approvedAt(LocalDateTime.of(2025, 2, 10, 9, 0))
                .closedAt(LocalDateTime.of(2025, 2, 28, 17, 0))
                .build());

        evnInvoiceRepository.save(EvnInvoice.builder()
                .period(p1)
                .invoiceDate(LocalDate.of(2025, 2, 28))
                .invoiceNumber("EVN-2025-02-001")
                .kwh(4819)
                .amount(new BigDecimal("7546419"))
                .build());

        // currentIndex per customer; previousIndex = 0 for all (first period)
        int[] currIdx = {480, 512, 445, 523, 498, 412, 534, 476, 467, 472};
        LocalDateTime readBase  = LocalDateTime.of(2025, 2, 8, 8, 10);
        for (int i = 0; i < 10; i++) {
            meterReadingRepository.save(MeterReading.builder()
                    .period(p1)
                    .customer(customers.get(i))
                    .previousIndex(0)
                    .currentIndex(currIdx[i])
                    .readAt(readBase.plusMinutes(i * 25L))
                    .readBy(reader)
                    .build());
        }

        BillStatus[] statuses = {
            BillStatus.PAID, BillStatus.PAID, BillStatus.PAID, BillStatus.PAID, BillStatus.PAID,   // KH001-005
            BillStatus.PARTIAL, BillStatus.PARTIAL, BillStatus.PARTIAL,                            // KH006-008
            BillStatus.OVERDUE, BillStatus.OVERDUE                                                 // KH009-010
        };
        // payment method for indices 0-7 (OVERDUE have no payment)
        PaymentMethod[] methods = {
            PaymentMethod.BANK_TRANSFER, PaymentMethod.BANK_TRANSFER, PaymentMethod.CASH,
            PaymentMethod.BANK_TRANSFER, PaymentMethod.CASH,
            PaymentMethod.CASH, PaymentMethod.CASH, PaymentMethod.BANK_TRANSFER
        };
        String[] txnIds = {
            "TXN-202502-KH001", "TXN-202502-KH002", null,
            "TXN-202502-KH004", null,
            null, null, "TXN-202502-KH008"
        };

        for (int i = 0; i < 10; i++) {
            Customer c    = customers.get(i);
            int cons      = currIdx[i];
            BigDecimal elec  = unitPrice.multiply(BigDecimal.valueOf(cons));
            BigDecimal svc   = servicePrice.multiply(BigDecimal.valueOf(cons));
            BigDecimal total = elec.add(svc);
            BigDecimal paid  = paidAmount(statuses[i], total);

            Bill bill = billRepository.save(Bill.builder()
                    .period(p1).customer(c)
                    .consumption(cons)
                    .unitPrice(unitPrice).serviceUnitPrice(servicePrice)
                    .electricityAmount(elec).serviceAmount(svc).totalAmount(total)
                    .paidAmount(paid).status(statuses[i])
                    .paymentCode("TIENDIEN 2025-02 " + c.getCode())
                    .build());

            if (i < 8) {
                paymentRepository.save(Payment.builder()
                        .bill(bill).amount(paid).method(methods[i])
                        .paidAt(LocalDateTime.of(2025, 2, 15 + i, 10, 0))
                        .bankTransactionId(txnIds[i])
                        .recordedBy(accountant)
                        .build());
            }
        }
    }

    // ── Period 2 — 2025-03 — APPROVED ────────────────────────────────────────
    //
    //  EVN: 5100 kWh / 8,000,000 VND · extraFee = 100,000
    //  unitPrice = round((8,000,000 + 100,000) / 5100) = 1588
    //  Status: APPROVED; 3 PAID · 4 PENDING · 2 PARTIAL · 1 SENT
    //  + 1 unmatched payment (bill_id = null)

    private void seedPeriod2(List<Customer> customers, User admin, User accountant, User reader) {
        BigDecimal unitPrice    = new BigDecimal("1588");
        BigDecimal servicePrice = new BigDecimal("500");

        BillingPeriod p2 = billingPeriodRepository.save(BillingPeriod.builder()
                .code("2025-03")
                .name("Kỳ tháng 03/2025")
                .startDate(LocalDate.of(2025, 3, 1))
                .endDate(LocalDate.of(2025, 3, 31))
                .evnTotalAmount(new BigDecimal("8000000"))
                .evnTotalKwh(5100)
                .extraFee(new BigDecimal("100000"))
                .serviceUnitPrice(servicePrice)
                .unitPrice(unitPrice)
                .status(PeriodStatus.APPROVED)
                .approvedBy(admin)
                .approvedAt(LocalDateTime.of(2025, 3, 10, 9, 0))
                .build());

        evnInvoiceRepository.save(EvnInvoice.builder()
                .period(p2)
                .invoiceDate(LocalDate.of(2025, 3, 31))
                .invoiceNumber("EVN-2025-03-001")
                .kwh(5100)
                .amount(new BigDecimal("8000000"))
                .build());

        int[] prevIdx = {480, 512, 445, 523, 498, 412, 534, 476, 467, 472};
        int[] currIdx = {990, 1035, 906, 1063, 1013, 833, 1090, 966, 951, 1072};
        LocalDateTime readBase = LocalDateTime.of(2025, 3, 8, 8, 10);
        for (int i = 0; i < 10; i++) {
            meterReadingRepository.save(MeterReading.builder()
                    .period(p2).customer(customers.get(i))
                    .previousIndex(prevIdx[i]).currentIndex(currIdx[i])
                    .readAt(readBase.plusMinutes(i * 25L))
                    .readBy(reader)
                    .build());
        }

        int[] consumptions = {510, 523, 461, 540, 515, 421, 556, 490, 484, 600};
        BillStatus[] statuses = {
            BillStatus.PAID, BillStatus.PAID, BillStatus.PAID,         // KH001-003
            BillStatus.PENDING, BillStatus.PENDING,                    // KH004-005
            BillStatus.PARTIAL, BillStatus.PARTIAL,                    // KH006-007
            BillStatus.PENDING, BillStatus.PENDING,                    // KH008-009
            BillStatus.SENT                                            // KH010
        };

        List<Bill> p2Bills = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            Customer c    = customers.get(i);
            int cons      = consumptions[i];
            BigDecimal elec  = unitPrice.multiply(BigDecimal.valueOf(cons));
            BigDecimal svc   = servicePrice.multiply(BigDecimal.valueOf(cons));
            BigDecimal total = elec.add(svc);
            BigDecimal paid  = paidAmount(statuses[i], total);
            boolean isSent   = statuses[i] == BillStatus.SENT;

            p2Bills.add(billRepository.save(Bill.builder()
                    .period(p2).customer(c)
                    .consumption(cons)
                    .unitPrice(unitPrice).serviceUnitPrice(servicePrice)
                    .electricityAmount(elec).serviceAmount(svc).totalAmount(total)
                    .paidAmount(paid).status(statuses[i])
                    .paymentCode("TIENDIEN 2025-03 " + c.getCode())
                    .sentViaZalo(isSent)
                    .sentAt(isSent ? LocalDateTime.of(2025, 3, 12, 9, 0) : null)
                    .build()));
        }

        // payments for KH001(idx 0), KH002(1), KH003(2), KH006(5), KH007(6)
        int[]          payIdx  = {0,    1,    2,    5,    6};
        PaymentMethod[] methods = {
            PaymentMethod.BANK_TRANSFER, PaymentMethod.BANK_TRANSFER, PaymentMethod.CASH,
            PaymentMethod.CASH, PaymentMethod.BANK_TRANSFER
        };
        String[] txnIds = {
            "TXN-202503-KH001", "TXN-202503-KH002", null,
            null, "TXN-202503-KH007"
        };

        for (int k = 0; k < payIdx.length; k++) {
            Bill bill = p2Bills.get(payIdx[k]);
            paymentRepository.save(Payment.builder()
                    .bill(bill).amount(bill.getPaidAmount()).method(methods[k])
                    .paidAt(LocalDateTime.of(2025, 3, 15 + k, 10, 0))
                    .bankTransactionId(txnIds[k])
                    .recordedBy(accountant)
                    .build());
        }

        // unmatched payment — bill_id = null, for demo of /api/payments/unmatched
        paymentRepository.save(Payment.builder()
                .bill(null)
                .amount(new BigDecimal("500000"))
                .method(PaymentMethod.BANK_TRANSFER)
                .paidAt(LocalDateTime.of(2025, 3, 25, 10, 0))
                .bankTransactionId("TXN-UNMATCHED-202503")
                .rawContent("TIEN DIEN KHACH HANG XYZ 500000")
                .recordedBy(accountant)
                .build());
    }

    // ── Period 3 — 2025-04 — OPEN ────────────────────────────────────────────
    //
    //  No EVN invoice yet; 6/10 readings submitted; no bills.
    //  Reader is mid-cycle — 4 readings outstanding.

    private void seedPeriod3(List<Customer> customers, User reader) {
        BillingPeriod p3 = billingPeriodRepository.save(BillingPeriod.builder()
                .code("2025-04")
                .name("Kỳ tháng 04/2025")
                .startDate(LocalDate.of(2025, 4, 1))
                .endDate(LocalDate.of(2025, 4, 30))
                .serviceUnitPrice(new BigDecimal("500"))
                .build());

        // previousIndex = P2 currentIndex; currentIndex = submitted value or same as prev (unread)
        int[] prevIdx = {990, 1035, 906, 1063, 1013, 833, 1090, 966, 951, 1072};
        int[] currIdx = {1488, 1562, 1355, 1594, 1521, 1248, 1090, 966, 951, 1072};
        // KH007-010 (indices 6-9) are not yet submitted: currentIndex = previousIndex
        LocalDateTime readBase = LocalDateTime.of(2025, 4, 7, 8, 10);

        for (int i = 0; i < 10; i++) {
            boolean submitted = i < 6;
            meterReadingRepository.save(MeterReading.builder()
                    .period(p3).customer(customers.get(i))
                    .previousIndex(prevIdx[i])
                    .currentIndex(currIdx[i])
                    .readAt(submitted ? readBase.plusMinutes(i * 25L) : null)
                    .readBy(submitted ? reader : null)
                    .build());
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private BigDecimal paidAmount(BillStatus status, BigDecimal total) {
        return switch (status) {
            case PAID    -> total;
            case PARTIAL -> total.divide(new BigDecimal("2"), 0, RoundingMode.HALF_UP);
            default      -> BigDecimal.ZERO;
        };
    }
}
