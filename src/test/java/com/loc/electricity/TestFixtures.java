package com.loc.electricity;

import com.loc.electricity.domain.bill.Bill;
import com.loc.electricity.domain.bill.BillStatus;
import com.loc.electricity.domain.customer.Customer;
import com.loc.electricity.domain.payment.Payment;
import com.loc.electricity.domain.payment.PaymentMethod;
import com.loc.electricity.domain.period.BillingPeriod;
import com.loc.electricity.domain.period.EvnInvoice;
import com.loc.electricity.domain.reading.MeterReading;
import com.loc.electricity.domain.user.Role;
import com.loc.electricity.domain.user.User;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public final class TestFixtures {

    public static final String RAW_PASSWORD = "Password123!";
    private static final PasswordEncoder encoder = new BCryptPasswordEncoder();

    private TestFixtures() {}

    public static User admin() {
        return User.builder()
                .username("test_admin")
                .passwordHash(encoder.encode(RAW_PASSWORD))
                .fullName("Test Admin")
                .role(Role.ADMIN)
                .build();
    }

    public static User accountant() {
        return User.builder()
                .username("test_accountant")
                .passwordHash(encoder.encode(RAW_PASSWORD))
                .fullName("Test Accountant")
                .role(Role.ACCOUNTANT)
                .build();
    }

    public static User meterReader() {
        return User.builder()
                .username("test_reader")
                .passwordHash(encoder.encode(RAW_PASSWORD))
                .fullName("Test Reader")
                .role(Role.METER_READER)
                .build();
    }

    public static Customer customer(String code, String name) {
        return Customer.builder()
                .code(code)
                .fullName(name)
                .build();
    }

    // Builds an unsaved BillingPeriod in OPEN status with the given date range and service fee.
    public static BillingPeriod openPeriod(String code, LocalDate start, LocalDate end) {
        return BillingPeriod.builder()
                .code(code)
                .name("Period " + code)
                .startDate(start)
                .endDate(end)
                .serviceFee(new BigDecimal("10000"))
                .build();
    }

    // Builds an EvnInvoice. Does NOT update period.evnTotalAmount — caller must do that after saving.
    public static EvnInvoice evnInvoice(BillingPeriod period, int kwh, BigDecimal amount) {
        return EvnInvoice.builder()
                .period(period)
                .invoiceDate(period.getStartDate())
                .invoiceNumber("EVN-TEST-" + kwh)
                .kwh(kwh)
                .amount(amount)
                .build();
    }

    // Builds an unsaved MeterReading that counts as submitted (readAt is set).
    // IMPORTANT: only sets previousIndex and currentIndex; consumption is a DB-generated column.
    public static MeterReading submittedReading(BillingPeriod period, Customer customer,
                                                int previousIndex, int currentIndex, User reader) {
        return MeterReading.builder()
                .period(period)
                .customer(customer)
                .previousIndex(previousIndex)
                .currentIndex(currentIndex)
                .readAt(LocalDateTime.now())
                .readBy(reader)
                .build();
    }

    // Builds an unsaved MeterReading that has NOT been submitted yet (readAt is null).
    public static MeterReading unsubmittedReading(BillingPeriod period, Customer customer,
                                                  int previousIndex) {
        return MeterReading.builder()
                .period(period)
                .customer(customer)
                .previousIndex(previousIndex)
                .currentIndex(previousIndex)
                .build();
    }

    // Builds an unsaved Bill with the given total and status. Derives electricity/service amounts from total.
    public static Bill bill(BillingPeriod period, Customer customer,
                            BigDecimal totalAmount, BillStatus status) {
        BigDecimal serviceFee = new BigDecimal("10000");
        BigDecimal electricityAmount = totalAmount.compareTo(serviceFee) >= 0
                ? totalAmount.subtract(serviceFee) : BigDecimal.ZERO;
        return Bill.builder()
                .period(period)
                .customer(customer)
                .consumption(100)
                .unitPrice(new BigDecimal("1000"))
                .serviceFee(serviceFee)
                .electricityAmount(electricityAmount)
                .serviceAmount(serviceFee)
                .totalAmount(totalAmount)
                .status(status)
                .paymentCode("TIENDIEN " + period.getCode() + " " + customer.getCode())
                .build();
    }

    public static Payment cashPayment(BigDecimal amount, Bill bill) {
        return Payment.builder()
                .bill(bill)
                .amount(amount)
                .method(PaymentMethod.CASH)
                .paidAt(LocalDateTime.now())
                .build();
    }

    public static Payment unmatchedBankTransfer(BigDecimal amount, String bankTxId) {
        return Payment.builder()
                .amount(amount)
                .method(PaymentMethod.BANK_TRANSFER)
                .paidAt(LocalDateTime.now())
                .bankTransactionId(bankTxId)
                .build();
    }
}
