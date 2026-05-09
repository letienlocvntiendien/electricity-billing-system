-- SMS log table for tracking SpeedSMS notifications sent to customers
CREATE TABLE sms_log (
    id                      BIGINT NOT NULL AUTO_INCREMENT,
    bill_id                 BIGINT,
    customer_id             BIGINT,
    phone_number            VARCHAR(20)  NOT NULL,
    content                 TEXT         NOT NULL,
    provider                VARCHAR(50)  NOT NULL DEFAULT 'SpeedSMS',
    external_transaction_id VARCHAR(100),
    status                  VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    error_message           TEXT,
    sent_at                 TIMESTAMP    NOT NULL,
    sent_by                 BIGINT,
    PRIMARY KEY (id)
);
