-- V2__v2_schema_changes_h2.sql
-- H2-compatible version of V4__v2_schema_changes.sql

ALTER TABLE billing_period
    ADD COLUMN service_fee DECIMAL(15, 2) NOT NULL DEFAULT 0;
UPDATE billing_period SET service_fee = service_unit_price;
ALTER TABLE billing_period DROP COLUMN service_unit_price;

ALTER TABLE billing_period
    ADD COLUMN accountant_verified_by BIGINT NULL,
    ADD COLUMN accountant_verified_at TIMESTAMP NULL;

ALTER TABLE evn_invoice
    DROP COLUMN kwh,
    DROP COLUMN amount;
ALTER TABLE evn_invoice
    ADD COLUMN normal_kwh     INT            NOT NULL DEFAULT 0,
    ADD COLUMN normal_amount  DECIMAL(15, 2) NOT NULL DEFAULT 0,
    ADD COLUMN peak_kwh       INT            NOT NULL DEFAULT 0,
    ADD COLUMN peak_amount    DECIMAL(15, 2) NOT NULL DEFAULT 0,
    ADD COLUMN off_peak_kwh   INT            NOT NULL DEFAULT 0,
    ADD COLUMN off_peak_amount DECIMAL(15, 2) NOT NULL DEFAULT 0;

ALTER TABLE bill
    ADD COLUMN service_fee DECIMAL(15, 2) NOT NULL DEFAULT 0;
UPDATE bill SET service_fee = service_unit_price;
ALTER TABLE bill DROP COLUMN service_unit_price;

UPDATE system_setting
SET setting_key = 'default_service_fee',
    setting_value = '10000',
    description = 'Default flat service fee per household per period'
WHERE setting_key = 'default_service_unit_price';

INSERT INTO system_setting (setting_key, setting_value, description)
SELECT 'loss_warning_threshold', '15', 'Loss warning threshold percent'
WHERE NOT EXISTS (SELECT 1 FROM system_setting WHERE setting_key = 'loss_warning_threshold');
