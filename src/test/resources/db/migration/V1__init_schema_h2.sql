-- V1__init_schema_h2.sql
-- H2-compatible schema for tests (MODE=MySQL).
-- Changes from MySQL version:
--   ENUM(...) → VARCHAR(50)
--   GENERATED ALWAYS AS ... STORED → plain INT (computed in application layer)
--   JSON → CLOB
--   Removed utf8mb4 collation, ENGINE=InnoDB, SET NAMES, SET FOREIGN_KEY_CHECKS

CREATE TABLE `user` (
    id              BIGINT NOT NULL AUTO_INCREMENT,
    username        VARCHAR(50) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(200) NOT NULL,
    role            VARCHAR(50) NOT NULL,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE (username)
);

CREATE TABLE customer (
    id              BIGINT NOT NULL AUTO_INCREMENT,
    code            VARCHAR(20) NOT NULL,
    full_name       VARCHAR(200) NOT NULL,
    phone           VARCHAR(20),
    zalo_phone      VARCHAR(20),
    meter_serial    VARCHAR(50),
    notes           CLOB,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE (code)
);

CREATE TABLE billing_period (
    id                  BIGINT NOT NULL AUTO_INCREMENT,
    code                VARCHAR(20) NOT NULL,
    name                VARCHAR(100) NOT NULL,
    start_date          DATE NOT NULL,
    end_date            DATE NOT NULL,
    evn_total_amount    DECIMAL(15, 2) NOT NULL DEFAULT 0,
    evn_total_kwh       INT NOT NULL DEFAULT 0,
    extra_fee           DECIMAL(15, 2) NOT NULL DEFAULT 0,
    unit_price          DECIMAL(10, 2),
    service_unit_price  DECIMAL(10, 2) NOT NULL,
    status              VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    approved_by         BIGINT,
    approved_at         TIMESTAMP NULL,
    closed_at           TIMESTAMP NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE (code),
    CONSTRAINT chk_period_dates CHECK (end_date >= start_date),
    CONSTRAINT fk_period_approver FOREIGN KEY (approved_by) REFERENCES `user` (id)
);

CREATE TABLE evn_invoice (
    id              BIGINT NOT NULL AUTO_INCREMENT,
    period_id       BIGINT NOT NULL,
    invoice_date    DATE NOT NULL,
    invoice_number  VARCHAR(50) NOT NULL,
    kwh             INT NOT NULL,
    amount          DECIMAL(15, 2) NOT NULL,
    attachment_url  VARCHAR(500),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_evn_period FOREIGN KEY (period_id) REFERENCES billing_period (id) ON DELETE CASCADE
);

CREATE TABLE meter_reading (
    id                 BIGINT NOT NULL AUTO_INCREMENT,
    period_id          BIGINT NOT NULL,
    customer_id        BIGINT NOT NULL,
    previous_index     INT NOT NULL,
    current_index      INT NOT NULL,
    consumption        INT,
    reading_photo_url  VARCHAR(500),
    read_at            TIMESTAMP NULL,
    read_by            BIGINT,
    created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE (period_id, customer_id),
    CONSTRAINT fk_reading_period FOREIGN KEY (period_id) REFERENCES billing_period (id) ON DELETE CASCADE,
    CONSTRAINT fk_reading_customer FOREIGN KEY (customer_id) REFERENCES customer (id),
    CONSTRAINT fk_reading_user FOREIGN KEY (read_by) REFERENCES `user` (id)
);

CREATE TABLE bill (
    id                  BIGINT NOT NULL AUTO_INCREMENT,
    period_id           BIGINT NOT NULL,
    customer_id         BIGINT NOT NULL,
    consumption         INT NOT NULL,
    unit_price          DECIMAL(10, 2) NOT NULL,
    service_unit_price  DECIMAL(10, 2) NOT NULL,
    electricity_amount  DECIMAL(15, 2) NOT NULL,
    service_amount      DECIMAL(15, 2) NOT NULL,
    total_amount        DECIMAL(15, 2) NOT NULL,
    paid_amount         DECIMAL(15, 2) NOT NULL DEFAULT 0,
    status              VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    payment_code        VARCHAR(50) NOT NULL,
    qr_code_url         VARCHAR(500),
    pdf_url             VARCHAR(500),
    sent_via_zalo       BOOLEAN NOT NULL DEFAULT FALSE,
    sent_at             TIMESTAMP NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE (period_id, customer_id),
    UNIQUE (payment_code),
    CONSTRAINT fk_bill_period FOREIGN KEY (period_id) REFERENCES billing_period (id),
    CONSTRAINT fk_bill_customer FOREIGN KEY (customer_id) REFERENCES customer (id)
);

CREATE TABLE payment (
    id                   BIGINT NOT NULL AUTO_INCREMENT,
    bill_id              BIGINT,
    amount               DECIMAL(15, 2) NOT NULL,
    method               VARCHAR(50) NOT NULL,
    paid_at              TIMESTAMP NOT NULL,
    bank_transaction_id  VARCHAR(100),
    bank_reference_code  VARCHAR(100),
    raw_content          CLOB,
    recorded_by          BIGINT,
    notes                CLOB,
    created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE (bank_transaction_id),
    CONSTRAINT fk_payment_bill FOREIGN KEY (bill_id) REFERENCES bill (id),
    CONSTRAINT fk_payment_user FOREIGN KEY (recorded_by) REFERENCES `user` (id)
);

CREATE TABLE system_setting (
    setting_key    VARCHAR(100) NOT NULL,
    setting_value  CLOB NOT NULL,
    description    VARCHAR(500),
    updated_by     BIGINT,
    updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (setting_key),
    CONSTRAINT fk_setting_user FOREIGN KEY (updated_by) REFERENCES `user` (id)
);

CREATE TABLE audit_log (
    id            BIGINT NOT NULL AUTO_INCREMENT,
    user_id       BIGINT,
    action        VARCHAR(50) NOT NULL,
    entity_type   VARCHAR(50) NOT NULL,
    entity_id     BIGINT,
    before_value  CLOB,
    after_value   CLOB,
    ip_address    VARCHAR(45),
    user_agent    VARCHAR(500),
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES `user` (id)
);

CREATE TABLE refresh_token (
    id          BIGINT NOT NULL AUTO_INCREMENT,
    user_id     BIGINT NOT NULL,
    token       VARCHAR(512) NOT NULL,
    expires_at  TIMESTAMP NOT NULL,
    revoked     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE (token),
    CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE
);

INSERT INTO system_setting (setting_key, setting_value, description) VALUES
    ('default_service_unit_price', '100',      'Default service unit price'),
    ('payment_code_prefix',        'TIENDIEN', 'Payment code prefix'),
    ('bank_account_number',        '',         'TPBank account number'),
    ('bank_account_holder',        '',         'TPBank account holder'),
    ('bank_bin_tpbank',            '970423',   'TPBank BIN for VietQR'),
    ('overdue_days',               '30',       'Days until bill becomes overdue'),
    ('reading_anomaly_threshold',  '300',      'Anomaly warning threshold percent');
