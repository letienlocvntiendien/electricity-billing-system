package com.loc.electricity.infrastructure.qr;

import com.loc.electricity.application.service.SystemSettingService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Service
@RequiredArgsConstructor
public class VietQrService {

    private static final String VIETQR_URL_TEMPLATE =
            "https://img.vietqr.io/image/%s-%s-compact2.png?amount=%s&addInfo=%s&accountName=%s";

    private final SystemSettingService systemSettingService;

    /** Builds a VietQR image URL for the given payment code and amount. */
    public String buildQrUrl(String paymentCode, BigDecimal amount) {
        // Read bank settings fresh each call — admin can update without restart
        String bankBin = systemSettingService.getValue("bank_bin");
        String accountNumber = systemSettingService.getValue("bank_account_number");
        String accountHolder = systemSettingService.getValue("bank_account_holder");

        String encodedAddInfo = URLEncoder.encode(paymentCode, StandardCharsets.UTF_8);
        String encodedName = URLEncoder.encode(accountHolder, StandardCharsets.UTF_8);

        return String.format(VIETQR_URL_TEMPLATE,
                bankBin, accountNumber,
                amount.toBigInteger(),
                encodedAddInfo, encodedName);
    }
}
