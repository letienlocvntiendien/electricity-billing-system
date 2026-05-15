package com.loc.electricity.infrastructure.webhook;

import java.math.BigDecimal;
import lombok.Data;

/** Raw JSON payload sent by SePay to our webhook endpoint. */
@Data
public class SepayWebhookPayload {

    private Long id;
    private String gateway;
    private String transactionDate;   // "yyyy-MM-dd HH:mm:ss" — parsed manually
    private String accountNumber;
    private String subAccount;
    private String code;
    private String content;
    private String transferType;      // "in" or "out"
    private BigDecimal transferAmount;
    private BigDecimal accumulated;
    private String referenceCode;
    private String description;
}
