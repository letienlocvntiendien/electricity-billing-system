package com.loc.electricity.infrastructure.zalo;

import com.loc.electricity.application.service.SystemSettingService;
import com.loc.electricity.domain.bill.Bill;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Component
@RequiredArgsConstructor
public class ZaloDeeplinkBuilder {

    private final SystemSettingService systemSettingService;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final NumberFormat VND_FMT = NumberFormat.getIntegerInstance(new Locale("vi", "VN"));

    public String build(Bill bill) {
        String phone = bill.getCustomer().getPhone();
        if (phone == null || phone.isBlank()) return null;

        int overdueDays = overdueDays();
        LocalDate dueDate = bill.getPeriod().getApprovedAt().toLocalDate().plusDays(overdueDays);

        String message = buildMessage(bill, dueDate);
        String encoded = URLEncoder.encode(message, StandardCharsets.UTF_8);

        return "https://zalo.me/" + phone + "?text=" + encoded;
    }

    private String buildMessage(Bill bill, LocalDate dueDate) {
        return String.format(
                "Xin chào %s,%n" +
                "Tiền điện kỳ %s: %d kWh%n" +
                "Số tiền: %s đ%n" +
                "Mã CK: %s%n" +
                "Hạn: %s",
                bill.getCustomer().getFullName(),
                bill.getPeriod().getName(),
                bill.getConsumption(),
                formatVnd(bill.getTotalAmount()),
                bill.getPaymentCode(),
                dueDate.format(DATE_FMT));
    }

    private String formatVnd(BigDecimal amount) {
        return VND_FMT.format(amount.longValue());
    }

    private int overdueDays() {
        try {
            return systemSettingService.getIntValue("overdue_days");
        } catch (Exception e) {
            return 30;
        }
    }
}
