-- ============================================================
-- V4__v2_schema_changes.sql
-- Spec V2 schema changes:
--   - billing_period: rename service_unit_price → service_fee (flat fee per household)
--   - billing_period: add accountant_verified_by + accountant_verified_at (4-eyes review)
--   - evn_invoice: replace kwh/amount with TOU 3-part breakdown
--   - bill: rename service_unit_price → service_fee
--   - system_setting: rename default_service_unit_price → default_service_fee, add loss_warning_threshold
-- ============================================================

-- 1. billing_period: rename service_unit_price → service_fee + add verified columns
ALTER TABLE billing_period
    CHANGE service_unit_price service_fee DECIMAL(15, 2) NOT NULL,
    ADD COLUMN accountant_verified_by BIGINT NULL AFTER service_fee,
    ADD COLUMN accountant_verified_at TIMESTAMP NULL AFTER accountant_verified_by,
    ADD CONSTRAINT fk_period_verifier FOREIGN KEY (accountant_verified_by) REFERENCES `user` (id);

-- 2. evn_invoice: drop old single-value columns, add TOU breakdown
ALTER TABLE evn_invoice
    DROP CONSTRAINT chk_evn_amount_positive,
    DROP CONSTRAINT chk_evn_kwh_positive,
    DROP COLUMN kwh,
    DROP COLUMN amount,
    ADD COLUMN normal_kwh    INT            NOT NULL DEFAULT 0 AFTER invoice_number,
    ADD COLUMN normal_amount DECIMAL(15, 2) NOT NULL DEFAULT 0 AFTER normal_kwh,
    ADD COLUMN peak_kwh      INT            NOT NULL DEFAULT 0 AFTER normal_amount,
    ADD COLUMN peak_amount   DECIMAL(15, 2) NOT NULL DEFAULT 0 AFTER peak_kwh,
    ADD COLUMN off_peak_kwh  INT            NOT NULL DEFAULT 0 AFTER peak_amount,
    ADD COLUMN off_peak_amount DECIMAL(15, 2) NOT NULL DEFAULT 0 AFTER off_peak_kwh;

-- 3. bill: rename service_unit_price → service_fee
ALTER TABLE bill
    CHANGE service_unit_price service_fee DECIMAL(15, 2) NOT NULL;

-- 4. system_setting: rename key and update default value
UPDATE system_setting
SET setting_key  = 'default_service_fee',
    setting_value = '10000',
    description   = 'Phí ghi điện cố định mặc định (đồng/hộ/kỳ)'
WHERE setting_key = 'default_service_unit_price';

INSERT IGNORE INTO system_setting (setting_key, setting_value, description)
VALUES ('loss_warning_threshold', '15', 'Cảnh báo nếu hao hụt > X% so với tổng EVN');
