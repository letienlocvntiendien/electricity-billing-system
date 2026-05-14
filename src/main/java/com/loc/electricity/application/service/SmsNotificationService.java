package com.loc.electricity.application.service;

import com.loc.electricity.application.dto.response.SmsResultResponse;
import com.loc.electricity.domain.bill.Bill;
import com.loc.electricity.domain.sms.SmsLog;
import com.loc.electricity.domain.sms.SmsLogStatus;
import com.loc.electricity.domain.user.User;
import com.loc.electricity.infrastructure.aws.AwsSnsClient;
import com.loc.electricity.infrastructure.persistence.BillRepository;
import com.loc.electricity.infrastructure.persistence.SmsLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Slf4j
public class SmsNotificationService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final NumberFormat VND_FMT = NumberFormat.getIntegerInstance(new Locale("vi", "VN"));

    private final BillRepository billRepository;
    private final SmsLogRepository smsLogRepository;
    private final AwsSnsClient awsSnsClient;
    private final SystemSettingService systemSettingService;

    @Transactional
    public List<SmsResultResponse> sendBillSmsBatch(List<Long> billIds, User actor) {
        List<Bill> bills = billRepository.findAllByIdIn(billIds);
        List<SmsResultResponse> results = new ArrayList<>();

        for (Bill bill : bills) {
            results.add(sendSingleBill(bill, actor));
        }

        return results;
    }

    private SmsResultResponse sendSingleBill(Bill bill, User actor) {
        String customerCode = bill.getCustomer().getCode();
        String customerName = bill.getCustomer().getFullName();
        String phone = bill.getCustomer().getPhone();

        if (phone == null || phone.isBlank()) {
            log.warn("Bill {} ({}): customer has no phone number — skipping", bill.getId(), customerCode);
            return new SmsResultResponse(bill.getId(), customerCode, customerName,
                    null, false, "Khách hàng chưa có số điện thoại");
        }

        String content = buildContent(bill);

        log.info("SMS content for bill={} customer={} phone={}:\n{}",
                bill.getId(), customerCode, phone, content);

        SmsLog smsLog = SmsLog.builder()
                .bill(bill)
                .customer(bill.getCustomer())
                .phoneNumber(phone)
                .content(content)
                .provider("AWS_SNS")
                .sentAt(LocalDateTime.now())
                .sentBy(actor)
                .build();
        smsLogRepository.save(smsLog);

        try {
            String messageId = awsSnsClient.send(phone, content);
            smsLog.setStatus(SmsLogStatus.SENT);
            smsLog.setExternalTransactionId(messageId);
            smsLogRepository.save(smsLog);
            log.info("SMS sent: bill={} customer={} phone={} messageId={}",
                    bill.getId(), customerCode, phone, messageId);
            return new SmsResultResponse(bill.getId(), customerCode, customerName, phone, true, null);
        } catch (Exception e) {
            smsLog.setStatus(SmsLogStatus.FAILED);
            smsLog.setErrorMessage(e.getMessage());
            smsLogRepository.save(smsLog);
            log.error("SMS failed: bill={} customer={} phone={}", bill.getId(), customerCode, phone, e);
            return new SmsResultResponse(bill.getId(), customerCode, customerName, phone, false, e.getMessage());
        }
    }

    private String buildContent(Bill bill) {
        int overdueDays = overdueDays();
        LocalDate dueDate = bill.getPeriod().getApprovedAt().toLocalDate().plusDays(overdueDays);

        String raw = String.format(
                "HD dien [%s] - %s\n%d kWh - %sd\nCK: %s\nHan: %s",
                bill.getPeriod().getName(),
                bill.getCustomer().getFullName(),
                bill.getConsumption(),
                formatVnd(bill.getTotalAmount()),
                bill.getPaymentCode(),
                dueDate.format(DATE_FMT));

        return stripDiacritics(raw);
    }

    private String stripDiacritics(String s) {
        String normalized = Normalizer.normalize(s, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return normalized.replace('đ', 'd').replace('Đ', 'D');
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
