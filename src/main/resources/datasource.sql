-- ============================================================
-- V1__init_schema.sql
-- Electricity Billing System — Initial Schema
-- MySQL 8.0+, utf8mb4
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------
-- 1. user
-- ----------------------------------------------------------------
CREATE TABLE `user` (
                        id              BIGINT NOT NULL AUTO_INCREMENT,
                        username        VARCHAR(50) NOT NULL,
                        password_hash   VARCHAR(255) NOT NULL,
                        full_name       VARCHAR(200) NOT NULL,
                        role            ENUM('ADMIN', 'ACCOUNTANT', 'METER_READER') NOT NULL,
                        active          BOOLEAN NOT NULL DEFAULT TRUE,
                        created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        PRIMARY KEY (id),
                        UNIQUE KEY uk_user_username (username),
                        KEY idx_user_role (role)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- 2. customer
-- ----------------------------------------------------------------
CREATE TABLE customer (
                          id              BIGINT NOT NULL AUTO_INCREMENT,
                          code            VARCHAR(20) NOT NULL,
                          full_name       VARCHAR(200) NOT NULL,
                          phone           VARCHAR(20),
                          zalo_phone      VARCHAR(20),
                          meter_serial    VARCHAR(50),
                          notes           TEXT,
                          active          BOOLEAN NOT NULL DEFAULT TRUE,
                          created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                          updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                          PRIMARY KEY (id),
                          UNIQUE KEY uk_customer_code (code),
                          KEY idx_customer_active (active),
                          KEY idx_customer_name (full_name)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- 3. billing_period
-- ----------------------------------------------------------------
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
                                status              ENUM('OPEN', 'READING_DONE', 'CALCULATED', 'APPROVED', 'CLOSED')
                            NOT NULL DEFAULT 'OPEN',
                                approved_by         BIGINT,
                                approved_at         TIMESTAMP NULL,
                                closed_at           TIMESTAMP NULL,
                                created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                                PRIMARY KEY (id),
                                UNIQUE KEY uk_period_code (code),
                                KEY idx_period_status (status),
                                KEY idx_period_dates (start_date, end_date),
                                CONSTRAINT fk_period_approver FOREIGN KEY (approved_by) REFERENCES `user` (id),
                                CONSTRAINT chk_period_dates CHECK (end_date >= start_date)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- 4. evn_invoice
-- ----------------------------------------------------------------
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
                             KEY idx_evn_period (period_id),
                             CONSTRAINT fk_evn_period FOREIGN KEY (period_id)
                                 REFERENCES billing_period (id) ON DELETE CASCADE,
                             CONSTRAINT chk_evn_amount_positive CHECK (amount > 0),
                             CONSTRAINT chk_evn_kwh_positive CHECK (kwh > 0)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- 5. meter_reading
-- ----------------------------------------------------------------
CREATE TABLE meter_reading (
                               id                 BIGINT NOT NULL AUTO_INCREMENT,
                               period_id          BIGINT NOT NULL,
                               customer_id        BIGINT NOT NULL,
                               previous_index     INT NOT NULL,
                               current_index      INT NOT NULL,
                               consumption        INT GENERATED ALWAYS AS (current_index - previous_index) STORED,
                               reading_photo_url  VARCHAR(500),
                               read_at            TIMESTAMP NULL,
                               read_by            BIGINT,
                               created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                               updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                               PRIMARY KEY (id),
                               UNIQUE KEY uk_reading_period_customer (period_id, customer_id),
                               KEY idx_reading_customer (customer_id),
                               KEY idx_reading_consumption (consumption),
                               CONSTRAINT fk_reading_period FOREIGN KEY (period_id)
                                   REFERENCES billing_period (id) ON DELETE CASCADE,
                               CONSTRAINT fk_reading_customer FOREIGN KEY (customer_id)
                                   REFERENCES customer (id),
                               CONSTRAINT fk_reading_user FOREIGN KEY (read_by) REFERENCES `user` (id),
                               CONSTRAINT chk_reading_index CHECK (current_index >= previous_index),
                               CONSTRAINT chk_reading_index_nonneg CHECK (previous_index >= 0)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- 6. bill
-- ----------------------------------------------------------------
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
                      status              ENUM('PENDING', 'SENT', 'PARTIAL', 'PAID', 'OVERDUE')
                            NOT NULL DEFAULT 'PENDING',
                      payment_code        VARCHAR(50) NOT NULL,
                      qr_code_url         VARCHAR(500),
                      pdf_url             VARCHAR(500),
                      sent_via_zalo       BOOLEAN NOT NULL DEFAULT FALSE,
                      sent_at             TIMESTAMP NULL,
                      created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                      updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                      PRIMARY KEY (id),
                      UNIQUE KEY uk_bill_period_customer (period_id, customer_id),
                      UNIQUE KEY uk_bill_payment_code (payment_code),
                      KEY idx_bill_status (status),
                      KEY idx_bill_customer (customer_id),
                      CONSTRAINT fk_bill_period FOREIGN KEY (period_id) REFERENCES billing_period (id),
                      CONSTRAINT fk_bill_customer FOREIGN KEY (customer_id) REFERENCES customer (id),
                      CONSTRAINT chk_bill_paid_nonneg CHECK (paid_amount >= 0)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- 7. payment
-- ----------------------------------------------------------------
CREATE TABLE payment (
                         id                   BIGINT NOT NULL AUTO_INCREMENT,
                         bill_id              BIGINT,
                         amount               DECIMAL(15, 2) NOT NULL,
                         method               ENUM('BANK_TRANSFER', 'CASH', 'OTHER') NOT NULL,
                         paid_at              TIMESTAMP NOT NULL,
                         bank_transaction_id  VARCHAR(100),
                         bank_reference_code  VARCHAR(100),
                         raw_content          TEXT,
                         recorded_by          BIGINT,
                         notes                TEXT,
                         created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                         PRIMARY KEY (id),
                         UNIQUE KEY uk_payment_bank_txn (bank_transaction_id),
                         KEY idx_payment_bill (bill_id),
                         KEY idx_payment_method (method),
                         KEY idx_payment_paid_at (paid_at),
                         CONSTRAINT fk_payment_bill FOREIGN KEY (bill_id) REFERENCES bill (id),
                         CONSTRAINT fk_payment_user FOREIGN KEY (recorded_by) REFERENCES `user` (id),
                         CONSTRAINT chk_payment_amount_positive CHECK (amount > 0)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- 8. system_setting
-- ----------------------------------------------------------------
CREATE TABLE system_setting (
                                setting_key    VARCHAR(100) NOT NULL,
                                setting_value  TEXT NOT NULL,
                                description    VARCHAR(500),
                                updated_by     BIGINT,
                                updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                                PRIMARY KEY (setting_key),
                                CONSTRAINT fk_setting_user FOREIGN KEY (updated_by) REFERENCES `user` (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- 9. audit_log
-- ----------------------------------------------------------------
CREATE TABLE audit_log (
                           id            BIGINT NOT NULL AUTO_INCREMENT,
                           user_id       BIGINT,
                           action        VARCHAR(50) NOT NULL,
                           entity_type   VARCHAR(50) NOT NULL,
                           entity_id     BIGINT,
                           before_value  JSON,
                           after_value   JSON,
                           ip_address    VARCHAR(45),
                           user_agent    VARCHAR(500),
                           created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                           PRIMARY KEY (id),
                           KEY idx_audit_entity (entity_type, entity_id),
                           KEY idx_audit_user (user_id),
                           KEY idx_audit_created (created_at),
                           KEY idx_audit_action (action),
                           CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES `user` (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- Default settings
-- ============================================================
INSERT INTO system_setting (setting_key, setting_value, description) VALUES
                                                                         ('default_service_unit_price', '100',      'Đơn giá tiền công mặc định (đồng/kWh)'),
                                                                         ('payment_code_prefix',        'TIENDIEN', 'Tiền tố mã thanh toán dùng trong nội dung CK'),
                                                                         ('bank_account_number',        '',         'Số tài khoản TPBank nhận tiền điện'),
                                                                         ('bank_account_holder',        '',         'Tên chủ tài khoản TPBank'),
                                                                         ('bank_bin_tpbank',            '970423',   'Mã BIN ngân hàng TPBank cho VietQR'),
                                                                         ('overdue_days',               '30',       'Số ngày sau APPROVED chuyển bill thành OVERDUE'),
                                                                         ('reading_anomaly_threshold',  '300',      'Cảnh báo nếu consumption lệch >X% so với trung bình 3 kỳ trước');