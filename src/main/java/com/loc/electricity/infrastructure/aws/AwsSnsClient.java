package com.loc.electricity.infrastructure.aws;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.sns.SnsClient;
import software.amazon.awssdk.services.sns.model.MessageAttributeValue;
import software.amazon.awssdk.services.sns.model.PublishRequest;
import software.amazon.awssdk.services.sns.model.PublishResponse;
import software.amazon.awssdk.services.sns.model.SnsException;

import java.util.Map;

/**
 * AWS SNS client wrapper for sending transactional SMS messages.
 * Handles Vietnamese phone number normalization to E.164 format (+84 prefix).
 */
@Component
@Slf4j
public class AwsSnsClient {

    private final SnsClient snsClient;
    private final String smsType;

    /**
     * Initializes the SNS client.
     * Uses static credentials when both {@code accessKeyId} and {@code secretAccessKey} are provided;
     * falls back to the AWS default credentials chain (instance profile, env vars, etc.) otherwise.
     *
     * @param region          AWS region (e.g. {@code ap-southeast-1})
     * @param accessKeyId     IAM access key ID; leave blank to use the default provider chain
     * @param secretAccessKey IAM secret access key; leave blank to use the default provider chain
     * @param smsType         SNS SMS type — {@code Transactional} or {@code Promotional}
     */
    public AwsSnsClient(
            @Value("${aws.region}") String region,
            @Value("${aws.access-key-id:}") String accessKeyId,
            @Value("${aws.secret-access-key:}") String secretAccessKey,
            @Value("${aws.sns.sms-type:Transactional}") String smsType) {

        AwsCredentialsProvider credentialsProvider;
        if (!accessKeyId.isBlank() && !secretAccessKey.isBlank()) {
            credentialsProvider = StaticCredentialsProvider.create(
                    AwsBasicCredentials.create(accessKeyId, secretAccessKey));
        } else {
            credentialsProvider = DefaultCredentialsProvider.create();
        }

        this.snsClient = SnsClient.builder()
                .region(Region.of(region))
                .credentialsProvider(credentialsProvider)
                .build();
        this.smsType = smsType;
        log.info("AwsSnsClient initialized: region={} smsType={}", region, smsType);
    }

    /**
     * Sends an SMS via AWS SNS.
     *
     * @param phone   the recipient phone number (Vietnamese format: {@code 0xxx}, {@code +84xxx}, or {@code 84xxx})
     * @param content the SMS body text
     * @return the SNS message ID on success
     * @throws RuntimeException if the SNS publish call fails
     */
    public String send(String phone, String content) {
        String e164Phone = toE164Vietnam(phone);
        log.info("AWS SNS → Sending: phone={} e164={} contentLength={}", phone, e164Phone, content.length());

        PublishRequest request = PublishRequest.builder()
                .phoneNumber(e164Phone)
                .message(content)
                .messageAttributes(Map.of(
                        "AWS.SNS.SMS.SMSType", MessageAttributeValue.builder()
                                .dataType("String")
                                .stringValue(smsType)
                                .build()
                ))
                .build();

        try {
            PublishResponse response = snsClient.publish(request);
            log.info("AWS SNS ← Success: messageId={}", response.messageId());
            return response.messageId();
        } catch (SnsException e) {
            log.error("AWS SNS ← Error: code={} message={}", e.awsErrorDetails().errorCode(), e.getMessage());
            throw new RuntimeException("AWS SNS error: " + e.awsErrorDetails().errorMessage(), e);
        } catch (Exception e) {
            log.error("AWS SNS ← Request failed for phone={}", phone, e);
            throw new RuntimeException("AWS SNS request failed: " + e.getMessage(), e);
        }
    }

    private String toE164Vietnam(String phone) {
        if (phone == null || phone.isBlank()) return phone;
        String digits = phone.strip();
        if (digits.startsWith("+")) return digits;
        if (digits.startsWith("0")) return "+84" + digits.substring(1);
        if (digits.startsWith("84")) return "+" + digits;
        return "+84" + digits;
    }
}
